"""
STEP 2: Run Gemini AI generation on downloaded batch images.

Reads metadata.json from each batch folder.
Generates output images and saves to workspace/{batch_id}/outputs/{image_id}.jpg
Updates image status in DB via API after each generation.

Supports resume: skips images that already have outputs.
Works per-batch so QA can start on completed batches while others generate.

Usage:
    python step2_generate.py                      # process all batches
    python step2_generate.py --batch <batch_id>    # process specific batch
"""
import io
import sys
import json
import random
import base64
import time
from pathlib import Path

from PIL import Image
from google import genai
from google.genai import types

from config import (
    GEMINI_API_KEY, GEMINI_MODEL, MODEL_FOLDER,
    WORKSPACE, SUPPORTED_EXTENSIONS, CATEGORY_PROMPTS
)
from api_client import update_image

client = genai.Client(api_key=GEMINI_API_KEY)


def load_models():
    """Load model (person) images from the shared models folder."""
    model_files = [
        f for f in MODEL_FOLDER.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    if not model_files:
        raise Exception(f"No model images found in {MODEL_FOLDER}")
    print(f"✓ Loaded {len(model_files)} model images\n")
    return model_files


def call_gemini(contents):
    """Call Gemini API with streaming and extract generated image."""
    config = types.GenerateContentConfig(response_modalities=["IMAGE"])

    generated_image_data = None

    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=contents,
        config=config,
    ):
        if (chunk.candidates and chunk.candidates[0].content
                and chunk.candidates[0].content.parts):
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                data = part.inline_data.data
                if isinstance(data, str):
                    data = base64.b64decode(data)
                elif not isinstance(data, bytes):
                    data = bytes(data)
                generated_image_data = data

    if generated_image_data is None:
        raise RuntimeError("Gemini returned no image data")

    return generated_image_data


def process_image(image_id, input_path, output_path, category, models_list):
    """Generate a single image using Gemini."""

    # Skip if output already exists
    if output_path.exists():
        return "skipped"

    try:
        # Mark as processing in DB
        update_image(image_id, "processing")

        jewelry_img = Image.open(input_path).convert("RGBA")
        model_path = random.choice(models_list)
        model_img = Image.open(model_path).convert("RGBA")

        # Convert to bytes
        jewelry_buffer = io.BytesIO()
        jewelry_img.convert("RGB").save(jewelry_buffer, format="JPEG")
        jewelry_bytes = jewelry_buffer.getvalue()

        model_buffer = io.BytesIO()
        model_img.convert("RGB").save(model_buffer, format="JPEG")
        model_bytes = model_buffer.getvalue()

        prompt = CATEGORY_PROMPTS.get(category, CATEGORY_PROMPTS["necklace"])

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_text(text="Image 1: Base Model"),
                    types.Part.from_bytes(mime_type="image/jpeg", data=model_bytes),
                    types.Part.from_text(text="Image 2: Reference Jewelry"),
                    types.Part.from_bytes(mime_type="image/jpeg", data=jewelry_bytes),
                ],
            )
        ]

        ai_bytes = call_gemini(contents)
        ai_img = Image.open(io.BytesIO(ai_bytes)).convert("RGBA")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        ai_img.convert("RGB").save(output_path, "JPEG", quality=95)

        # Mark as completed in DB
        update_image(image_id, "completed")

        return "done"

    except Exception as e:
        print(f"  ✗ Error: {e}")
        update_image(image_id, "failed", error_message=str(e)[:500])
        return "failed"


def process_batch(batch_dir, models_list):
    """Process all images in a single batch."""
    meta_path = batch_dir / "metadata.json"

    if not meta_path.exists():
        print(f"  Skipping {batch_dir.name}: no metadata.json")
        return

    with open(meta_path, "r") as f:
        metadata = json.load(f)

    batch_id = metadata["batch_id"]
    category = metadata["jewelry_category"]
    email = metadata["user_email"]
    images = metadata.get("images", [])

    print(f"\n━━━ Batch: {batch_id[:8]}... | {category} | {email} | {len(images)} images ━━━")

    outputs_dir = batch_dir / "outputs"
    outputs_dir.mkdir(exist_ok=True)

    done = 0
    skipped = 0
    failed = 0

    for idx, img_meta in enumerate(images, 1):
        image_id = img_meta["image_id"]
        input_path = batch_dir / img_meta["local_input"]
        output_path = outputs_dir / f"{image_id}.jpg"

        if not input_path.exists():
            print(f"  [{idx}/{len(images)}] Missing input: {input_path.name}")
            failed += 1
            continue

        print(f"  [{idx}/{len(images)}] Processing {image_id[:8]}...", end=" ")

        result = process_image(image_id, input_path, output_path, category, models_list)

        if result == "done":
            done += 1
            print("✓ Done")
        elif result == "skipped":
            skipped += 1
            print("→ Skipped (exists)")
        else:
            failed += 1
            print("✗ Failed")

    print(f"\n  Summary: {done} done | {skipped} skipped | {failed} failed")


def main():
    start_time = time.time()
    models_list = load_models()

    # Specific batch or all?
    target_batch = None
    if "--batch" in sys.argv:
        idx = sys.argv.index("--batch")
        if idx + 1 < len(sys.argv):
            target_batch = sys.argv[idx + 1]

    if target_batch:
        batch_dir = WORKSPACE / target_batch
        if batch_dir.exists():
            process_batch(batch_dir, models_list)
        else:
            print(f"Batch folder not found: {batch_dir}")
    else:
        # Process all batches in workspace
        batch_dirs = sorted([
            d for d in WORKSPACE.iterdir()
            if d.is_dir() and (d / "metadata.json").exists()
        ])

        if not batch_dirs:
            print("No batches found in workspace. Run step1_fetch.py first.")
            return

        print(f"Found {len(batch_dirs)} batches to process\n")

        for batch_dir in batch_dirs:
            process_batch(batch_dir, models_list)

    elapsed = time.time() - start_time
    print(f"\n{'='*50}")
    print(f"GENERATION COMPLETE — {elapsed:.1f}s")


if __name__ == "__main__":
    main()
