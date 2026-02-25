"""
STEP 1: Fetch pending batches from DB and download images locally.

Replaces the old CSV-export + batch-2.py download workflow.
Downloads to: workspace/{batch_id}/inputs/{image_id}.jpg
Saves metadata: workspace/{batch_id}/metadata.json

Usage:
    python step1_fetch.py
    python step1_fetch.py --include-failed    # also re-fetch failed batches
"""
import json
import sys
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

import requests

from config import WORKSPACE
from api_client import fetch_pending


def download_file(url, save_path):
    """Download a file from URL to local path."""
    if save_path.exists():
        return f"Skipped (exists): {save_path.name}"

    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(r.content)
        return f"✓ Downloaded: {save_path.name}"
    except Exception as e:
        return f"✗ Failed: {save_path.name} | {e}"


def get_extension(url):
    """Extract file extension from URL."""
    path = urlparse(url).path
    ext = os.path.splitext(path)[1]
    return ext if ext else ".jpg"


def main():
    include_failed = "--include-failed" in sys.argv

    statuses = ["pending"]
    if include_failed:
        statuses.append("failed")

    print(f"Fetching batches with status: {statuses}")
    batches = fetch_pending(statuses)
    print(f"Found {len(batches)} batches\n")

    if not batches:
        print("No pending batches. Nothing to download.")
        return

    for batch in batches:
        batch_id = batch["id"]
        category = batch["jewelry_category"]
        email = batch["user_email"]
        display_name = batch.get("user_display_name", "")
        images = batch.get("images", [])

        batch_dir = WORKSPACE / batch_id
        inputs_dir = batch_dir / "inputs"
        inspiration_dir = batch_dir / "inspiration"
        outputs_dir = batch_dir / "outputs"

        inputs_dir.mkdir(parents=True, exist_ok=True)
        inspiration_dir.mkdir(parents=True, exist_ok=True)
        outputs_dir.mkdir(parents=True, exist_ok=True)

        # Save metadata (preserves batch_id, email, category, all image details)
        metadata = {
            "batch_id": batch_id,
            "user_email": email,
            "user_display_name": display_name,
            "notification_email": batch.get("notification_email"),
            "jewelry_category": category,
            "inspiration_url": batch.get("inspiration_url"),
            "status": batch["status"],
            "total_images": batch["total_images"],
            "images": []
        }

        print(f"━━━ Batch: {batch_id[:8]}... | {category} | {email} | {len(images)} images ━━━")

        tasks = []

        with ThreadPoolExecutor(max_workers=10) as executor:
            for img in images:
                image_id = img["id"]
                seq = img["sequence_number"]
                original_url = img.get("original_url", "")
                inspiration_url = img.get("inspiration_url", "")
                skin_tone = img.get("skin_tone")

                ext = get_extension(original_url)
                local_input = inputs_dir / f"{image_id}{ext}"

                image_meta = {
                    "image_id": image_id,
                    "sequence_number": seq,
                    "original_url": original_url,
                    "inspiration_url": inspiration_url,
                    "skin_tone": skin_tone,
                    "local_input": str(local_input.relative_to(batch_dir)),
                    "status": img["status"],
                }

                # Download original
                if original_url.startswith("http"):
                    tasks.append(executor.submit(download_file, original_url, local_input))

                # Download inspiration
                if inspiration_url and inspiration_url.startswith("http"):
                    insp_path = inspiration_dir / f"{image_id}{get_extension(inspiration_url)}"
                    image_meta["local_inspiration"] = str(insp_path.relative_to(batch_dir))
                    tasks.append(executor.submit(download_file, inspiration_url, insp_path))

                metadata["images"].append(image_meta)

            for future in as_completed(tasks):
                print(f"  {future.result()}")

        # Save metadata.json
        meta_path = batch_dir / "metadata.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        print(f"  ✓ Metadata saved: {meta_path}\n")

    print("=" * 50)
    print("FETCH COMPLETE")
    print(f"Batches downloaded: {len(batches)}")
    print(f"Workspace: {WORKSPACE}")


if __name__ == "__main__":
    main()
