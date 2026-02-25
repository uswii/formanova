"""
API client for the pipeline-api edge function.
All DB interactions go through this — no CSV, no manual exports.
"""
import requests
from config import PIPELINE_API_URL, PIPELINE_API_KEY


HEADERS = {
    "x-api-key": PIPELINE_API_KEY,
    "Content-Type": "application/json",
}


def fetch_pending(statuses=None):
    """Fetch pending/failed batches with their images."""
    params = {"action": "fetch_pending"}
    if statuses:
        params["statuses"] = ",".join(statuses)

    r = requests.get(PIPELINE_API_URL, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data.get("batches", [])


def update_image(image_id, status, result_url=None, error_message=None):
    """Update a single image's status after generation."""
    body = {"image_id": image_id, "status": status}
    if result_url:
        body["result_url"] = result_url
    if error_message:
        body["error_message"] = error_message

    r = requests.post(
        f"{PIPELINE_API_URL}?action=update_image",
        headers=HEADERS, json=body, timeout=30
    )
    r.raise_for_status()
    return r.json()


def bulk_update_images(updates):
    """Bulk update multiple images at once.
    updates: [{ image_id, status, result_url?, error_message? }]
    """
    r = requests.post(
        f"{PIPELINE_API_URL}?action=bulk_update",
        headers=HEADERS, json={"updates": updates}, timeout=60
    )
    r.raise_for_status()
    return r.json()


def deliver(batch_id, images):
    """Trigger delivery for passed images.
    images: [{ image_id, result_url, filename }]
    Creates delivery records, sends email, marks batch delivered.
    """
    r = requests.post(
        f"{PIPELINE_API_URL}?action=deliver",
        headers=HEADERS,
        json={"batch_id": batch_id, "images": images},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()
