"""
AUTOPILOT: Continuously polls for pending batches, downloads, and generates.

Runs as a background daemon on your server. Checks for new pending batches
every POLL_INTERVAL seconds, downloads inputs, and starts generation automatically.

Steps 3 (QA) and 4 (Deliver) remain manual since QA needs human review.

Usage:
    python autopilot.py                    # run forever
    python autopilot.py --once             # run once and exit
    python autopilot.py --interval 120     # custom poll interval (seconds)

Run in background:
    nohup python autopilot.py > autopilot.log 2>&1 &
    # or use systemd/supervisor for production
"""
import sys
import time
import json
import io
import random
import base64
import traceback
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
import os

import requests
from PIL import Image
from google import genai
from google.genai import types

from config import (
    WORKSPACE, GEMINI_API_KEY, GEMINI_MODEL, MODEL_FOLDER,
    SUPPORTED_EXTENSIONS, CATEGORY_PROMPTS
)
from api_client import fetch_pending, update_image

# ==================== CONFIG ====================

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "90"))  # seconds between checks
MAX_DOWNLOAD_WORKERS = 10

client = genai.Client(api_key=GEMINI_API_KEY)


# ==================== DOWNLOAD ====================

def download_file(url, save_path):
    if save_path.exists():
        return True
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(r.content)
        return True
    except Exception as e:
        log(f"    ✗ Download failed: {save_path.name} | {e}")
        return False


def get_ext(url):
    ext = os.path.splitext(urlparse(url).path)[1]
    return ext if ext else ".jpg"


# ==================== GENERATION ====================

def load_models():
    models = [
        f for f in MODEL_FOLDER.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    if not models:
        raise Exception(f"No model images in {MODEL_FOLDER}")
    return models


def call_gemini(contents):
    config = types.GenerateContentConfig(response_modalities=["IMAGE"])
    image_data = None

    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL, contents=contents, config=config
    ):
        if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                data = part.inline_data.data
                image_data = base64.b64decode(data) if isinstance(data, str) else bytes(data)

    if image_data is None:
        raise RuntimeError("Gemini returned no image")
    return image_data


def generate_image(image_id, input_path, output_path, category, models_list):
    if output_path.exists():
        return "skipped"

    try:
        update_image(image_id, "processing")

        jewelry_img = Image.open(input_path).convert("RGBA")
        model_path = random.choice(models_list)
        model_img = Image.open(model_path).convert("RGBA")

        j_buf = io.BytesIO()
        jewelry_img.convert("RGB").save(j_buf, format="JPEG")

        m_buf = io.BytesIO()
        model_img.convert("RGB").save(m_buf, format="JPEG")

        prompt = CATEGORY_PROMPTS.get(category, CATEGORY_PROMPTS["necklace"])

        contents = [types.Content(role="user", parts=[
            types.Part.from_text(text=prompt),
            types.Part.from_text(text="Image 1: Base Model"),
            types.Part.from_bytes(mime_type="image/jpeg", data=m_buf.getvalue()),
            types.Part.from_text(text="Image 2: Reference Jewelry"),
            types.Part.from_bytes(mime_type="image/jpeg", data=j_buf.getvalue()),
        ])]

        ai_bytes = call_gemini(contents)
        ai_img = Image.open(io.BytesIO(ai_bytes)).convert("RGBA")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        ai_img.convert("RGB").save(output_path, "JPEG", quality=95)

        update_image(image_id, "completed")
        return "done"

    except Exception as e:
        update_image(image_id, "failed", error_message=str(e)[:500])
        return "failed"


# ==================== MAIN LOOP ====================

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def process_batch(batch, models_list):
    """Download inputs + run generation for one batch."""
    batch_id = batch["id"]
    category = batch["jewelry_category"]
    email = batch["user_email"]
    images = batch.get("images", [])

    batch_dir = WORKSPACE / batch_id
    inputs_dir = batch_dir / "inputs"
    outputs_dir = batch_dir / "outputs"
    inspiration_dir = batch_dir / "inspiration"

    inputs_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir.mkdir(parents=True, exist_ok=True)
    inspiration_dir.mkdir(parents=True, exist_ok=True)

    log(f"  ━━━ {batch_id[:8]}... | {category} | {email} | {len(images)} images ━━━")

    # Save metadata
    metadata = {
        "batch_id": batch_id,
        "user_email": email,
        "user_display_name": batch.get("user_display_name"),
        "notification_email": batch.get("notification_email"),
        "jewelry_category": category,
        "inspiration_url": batch.get("inspiration_url"),
        "total_images": batch["total_images"],
        "images": [],
    }

    # Download all inputs in parallel
    download_tasks = []
    image_metas = []

    with ThreadPoolExecutor(max_workers=MAX_DOWNLOAD_WORKERS) as executor:
        for img in images:
            image_id = img["id"]
            original_url = img.get("original_url", "")
            inspiration_url = img.get("inspiration_url", "")

            ext = get_ext(original_url)
            local_input = inputs_dir / f"{image_id}{ext}"

            img_meta = {
                "image_id": image_id,
                "sequence_number": img["sequence_number"],
                "original_url": original_url,
                "inspiration_url": inspiration_url,
                "skin_tone": img.get("skin_tone"),
                "local_input": str(local_input.relative_to(batch_dir)),
            }
            image_metas.append(img_meta)
            metadata["images"].append(img_meta)

            if original_url.startswith("http"):
                download_tasks.append(executor.submit(download_file, original_url, local_input))

            if inspiration_url and inspiration_url.startswith("http"):
                insp_path = inspiration_dir / f"{image_id}{get_ext(inspiration_url)}"
                img_meta["local_inspiration"] = str(insp_path.relative_to(batch_dir))
                download_tasks.append(executor.submit(download_file, inspiration_url, insp_path))

        # Wait for all downloads
        for future in as_completed(download_tasks):
            future.result()

    # Save metadata
    with open(batch_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    log(f"  ✓ Downloads complete. Starting generation...")

    # Generate each image
    done = 0
    skipped = 0
    failed = 0

    for idx, img_meta in enumerate(image_metas, 1):
        image_id = img_meta["image_id"]
        input_path = batch_dir / img_meta["local_input"]
        output_path = outputs_dir / f"{image_id}.jpg"

        if not input_path.exists():
            log(f"  [{idx}/{len(image_metas)}] Missing input — skip")
            failed += 1
            continue

        result = generate_image(image_id, input_path, output_path, category, models_list)

        if result == "done":
            done += 1
            log(f"  [{idx}/{len(image_metas)}] ✓ Generated")
        elif result == "skipped":
            skipped += 1
            log(f"  [{idx}/{len(image_metas)}] → Already exists")
        else:
            failed += 1
            log(f"  [{idx}/{len(image_metas)}] ✗ Failed")

    log(f"  Summary: {done} done | {skipped} skipped | {failed} failed")


def run_cycle(models_list):
    """One poll + process cycle."""
    log("Checking for pending batches...")

    try:
        batches = fetch_pending(["pending"])
    except Exception as e:
        log(f"✗ API error: {e}")
        return 0

    if not batches:
        log("No pending batches.")
        return 0

    log(f"Found {len(batches)} pending batches")

    for batch in batches:
        try:
            process_batch(batch, models_list)
        except Exception as e:
            log(f"✗ Batch {batch['id'][:8]}... failed: {e}")
            traceback.print_exc()

    return len(batches)


def main():
    run_once = "--once" in sys.argv

    # Custom interval
    interval = POLL_INTERVAL
    if "--interval" in sys.argv:
        idx = sys.argv.index("--interval")
        if idx + 1 < len(sys.argv):
            interval = int(sys.argv[idx + 1])

    log("=" * 60)
    log("FORMANOVA AUTOPILOT")
    log(f"Poll interval: {interval}s | Workspace: {WORKSPACE}")
    log(f"Model folder: {MODEL_FOLDER}")
    log("=" * 60)

    models_list = load_models()
    log(f"✓ Loaded {len(models_list)} model images\n")

    if run_once:
        run_cycle(models_list)
        log("Done (--once mode).")
        return

    # Continuous loop
    while True:
        try:
            run_cycle(models_list)
        except KeyboardInterrupt:
            log("\nStopping autopilot.")
            break
        except Exception as e:
            log(f"✗ Unexpected error: {e}")
            traceback.print_exc()

        log(f"Sleeping {interval}s...\n")
        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            log("\nStopping autopilot.")
            break


if __name__ == "__main__":
    main()
