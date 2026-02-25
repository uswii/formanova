"""
STEP 4: Upload passed QA results to Azure and trigger delivery.

Reads reviews.json for passed images.
Uploads each to Azure Blob Storage.
Calls the deliver API → creates delivery records + sends email.
Batch is auto-marked as 'delivered'.

NO CSV GENERATION. Everything goes through the API.

Usage:
    python step4_deliver.py                      # deliver all reviewed batches
    python step4_deliver.py --batch <batch_id>   # deliver specific batch
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

from azure.storage.blob import (
    BlobServiceClient,
    generate_blob_sas,
    BlobSasPermissions,
)

from config import AZURE_CONNECTION_STRING, AZURE_CONTAINER, WORKSPACE
from api_client import deliver


# ==================== AZURE SETUP ====================

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client = blob_service_client.get_container_client(AZURE_CONTAINER)
account_name = blob_service_client.account_name
account_key = blob_service_client.credential.account_key


def upload_to_azure(local_path, blob_name):
    """Upload file to Azure and return URL (without SAS — delivery system adds its own)."""
    blob_client = container_client.get_blob_client(blob_name)

    with open(local_path, "rb") as data:
        blob_client.upload_blob(data, overwrite=True)

    # Return base URL without SAS (delivery system regenerates SAS on-demand)
    return f"https://{account_name}.blob.core.windows.net/{AZURE_CONTAINER}/{blob_name}"


# ==================== DELIVER BATCH ====================

def deliver_batch(batch_dir):
    """Process a single batch: upload passed images + trigger delivery."""
    meta_path = batch_dir / "metadata.json"
    review_path = batch_dir / "reviews.json"

    if not meta_path.exists():
        print(f"  Skipping {batch_dir.name}: no metadata.json")
        return False

    if not review_path.exists():
        print(f"  Skipping {batch_dir.name}: no reviews.json (run step3_review.py first)")
        return False

    with open(meta_path, "r") as f:
        metadata = json.load(f)
    with open(review_path, "r") as f:
        reviews = json.load(f)

    batch_id = metadata["batch_id"]
    category = metadata["jewelry_category"]
    email = metadata["user_email"]
    all_images = metadata.get("images", [])

    # Build image_id → metadata lookup
    image_map = {img["image_id"]: img for img in all_images}

    # Collect passed images
    passed = []
    for image_id, review in reviews.items():
        if review.get("status") != "passed":
            continue
        if image_id not in image_map:
            continue
        passed.append(image_id)

    if not passed:
        print(f"  Skipping {batch_dir.name}: no passed images")
        return False

    print(f"\n━━━ Delivering: {batch_id[:8]}... | {category} | {email} ━━━")
    print(f"  Passed images: {len(passed)} / {len(all_images)}")

    # Upload each passed image to Azure
    delivery_images = []
    outputs_dir = batch_dir / "outputs"

    for image_id in passed:
        img_meta = image_map[image_id]
        seq = img_meta.get("sequence_number", 0)

        # Find output file
        output_path = outputs_dir / f"{image_id}.jpg"
        if not output_path.exists():
            for ext in [".png", ".jpeg", ".webp"]:
                alt = outputs_dir / f"{image_id}{ext}"
                if alt.exists():
                    output_path = alt
                    break

        if not output_path.exists():
            print(f"  ✗ Missing output for {image_id[:8]}... — skipping")
            continue

        # Upload to Azure under batch path
        blob_name = f"deliveries/{batch_id}/{image_id}{output_path.suffix}"
        print(f"  Uploading {image_id[:8]}...", end=" ")

        try:
            azure_url = upload_to_azure(output_path, blob_name)
            print("✓")
        except Exception as e:
            print(f"✗ {e}")
            continue

        delivery_images.append({
            "image_id": image_id,
            "result_url": azure_url,
            "filename": f"{category}_{seq}_{image_id[:8]}.jpg",
        })

    if not delivery_images:
        print("  No images uploaded successfully. Skipping delivery.")
        return False

    # Call deliver API → creates records + sends email + marks delivered
    print(f"\n  Triggering delivery for {len(delivery_images)} images...")

    try:
        result = deliver(batch_id, delivery_images)
        print(f"  ✓ Delivery triggered!")
        print(f"    Token: {result.get('token', 'N/A')}")
        print(f"    Email sent: {result.get('email_sent', False)}")
        print(f"    URL: {result.get('delivery_url', 'N/A')}")

        # Mark locally as delivered
        delivered_path = batch_dir / "delivered.json"
        with open(delivered_path, "w") as f:
            json.dump({
                "delivered_at": datetime.utcnow().isoformat(),
                "token": result.get("token"),
                "delivery_url": result.get("delivery_url"),
                "images_delivered": len(delivery_images),
                "email_sent": result.get("email_sent"),
            }, f, indent=2)

        return True

    except Exception as e:
        print(f"  ✗ Delivery failed: {e}")
        return False


# ==================== MAIN ====================

def main():
    target_batch = None
    if "--batch" in sys.argv:
        idx = sys.argv.index("--batch")
        if idx + 1 < len(sys.argv):
            target_batch = sys.argv[idx + 1]

    if target_batch:
        batch_dir = WORKSPACE / target_batch
        if not batch_dir.exists():
            print(f"Batch folder not found: {batch_dir}")
            return
        deliver_batch(batch_dir)
    else:
        # Process all batches that have reviews but no delivery
        batch_dirs = sorted([
            d for d in WORKSPACE.iterdir()
            if d.is_dir()
            and (d / "reviews.json").exists()
            and not (d / "delivered.json").exists()
        ])

        if not batch_dirs:
            print("No batches ready for delivery.")
            print("Either all are delivered or none have reviews.json yet.")
            return

        print(f"Found {len(batch_dirs)} batches ready for delivery\n")

        delivered = 0
        for batch_dir in batch_dirs:
            if deliver_batch(batch_dir):
                delivered += 1

        print(f"\n{'='*50}")
        print(f"DELIVERY COMPLETE: {delivered}/{len(batch_dirs)} batches delivered")


if __name__ == "__main__":
    main()
