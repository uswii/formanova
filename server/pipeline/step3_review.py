"""
STEP 3: QA Review UI (Tkinter)

Works INCREMENTALLY — you can review while generation is still running.
Shows only images that have outputs generated.
Press Refresh to pick up newly generated outputs.

Usage:
    python step3_review.py                      # auto-select first batch
    python step3_review.py --batch <batch_id>   # review specific batch

Keyboard shortcuts:
    Enter       = Pass
    Backspace   = Fail
    D           = Deliver all passed images now
    Right/Left  = Navigate
    1-5         = Set rating
    F5          = Refresh (scan for new outputs)
"""
import json
import sys
import io
import base64
import datetime
import threading
from pathlib import Path
from tkinter import *
from tkinter import messagebox, filedialog

from PIL import Image, ImageTk
from google import genai
from google.genai import types

from config import (
    GEMINI_API_KEY, GEMINI_MODEL, WORKSPACE,
    SUPPORTED_EXTENSIONS, CATEGORY_PROMPTS,
    AZURE_CONNECTION_STRING, AZURE_CONTAINER
)

from azure.storage.blob import BlobServiceClient

from api_client import deliver as api_deliver

COST_PER_GENERATION = 0.04

client = genai.Client(api_key=GEMINI_API_KEY)


# ==================== BATCH SELECTION ====================

def select_batch():
    """Find target batch from CLI arg or auto-select first available."""
    if "--batch" in sys.argv:
        idx = sys.argv.index("--batch")
        if idx + 1 < len(sys.argv):
            batch_dir = WORKSPACE / sys.argv[idx + 1]
            if batch_dir.exists():
                return batch_dir

    # Auto-select: list all batches with metadata
    batch_dirs = sorted([
        d for d in WORKSPACE.iterdir()
        if d.is_dir() and (d / "metadata.json").exists()
    ])

    if not batch_dirs:
        print("No batches found in workspace. Run step1_fetch.py first.")
        sys.exit(1)

    if len(batch_dirs) == 1:
        return batch_dirs[0]

    # Show selection menu
    print("\nAvailable batches:")
    for i, d in enumerate(batch_dirs, 1):
        meta = json.loads((d / "metadata.json").read_text())
        cat = meta.get("jewelry_category", "?")
        email = meta.get("user_email", "?")
        total = len(meta.get("images", []))
        outputs = len(list((d / "outputs").glob("*"))) if (d / "outputs").exists() else 0
        print(f"  {i}. {d.name[:8]}... | {cat} | {email} | {outputs}/{total} generated")

    choice = input("\nSelect batch number: ").strip()
    try:
        return batch_dirs[int(choice) - 1]
    except (ValueError, IndexError):
        print("Invalid choice.")
        sys.exit(1)


# ==================== MAIN APP ====================

class ReviewApp:
    def __init__(self, batch_dir):
        self.batch_dir = batch_dir
        self.outputs_dir = batch_dir / "outputs"
        self.inputs_dir = batch_dir / "inputs"
        self.review_file = batch_dir / "reviews.json"

        # Load metadata
        with open(batch_dir / "metadata.json", "r") as f:
            self.metadata = json.load(f)

        self.batch_id = self.metadata["batch_id"]
        self.category = self.metadata["jewelry_category"]
        self.email = self.metadata["user_email"]
        self.all_images = self.metadata.get("images", [])

        # Build image_id → metadata lookup
        self.image_map = {img["image_id"]: img for img in self.all_images}

        # Load existing reviews
        if self.review_file.exists():
            with open(self.review_file, "r") as f:
                self.reviews = json.load(f)
        else:
            self.reviews = {}

        self.total_cost = sum(
            item.get("estimated_cost", 0)
            for item in self.reviews.values()
        )

        # Scan for available outputs
        self.refresh_available()

        # Find first unreviewed
        self.current_index = self.find_first_unreviewed()

        # Build UI
        self.build_ui()

    def refresh_available(self):
        """Scan outputs folder for generated images (incremental)."""
        self.available = []
        for img_meta in self.all_images:
            image_id = img_meta["image_id"]
            # Check for output with any extension
            output = self.outputs_dir / f"{image_id}.jpg"
            if output.exists():
                self.available.append(image_id)

        # Also check other extensions
        for f in self.outputs_dir.iterdir():
            stem = f.stem
            if stem not in self.available and stem in self.image_map:
                self.available.append(stem)

    def find_first_unreviewed(self):
        """Find first available image not yet reviewed."""
        for i, image_id in enumerate(self.available):
            status = self.reviews.get(image_id, {}).get("status")
            if status not in ["passed", "failed"]:
                return i
        return None

    def save_reviews(self):
        with open(self.review_file, "w") as f:
            json.dump(self.reviews, f, indent=2)

    # ==================== UI ====================

    def build_ui(self):
        self.root = Tk()
        self.root.title(f"QA Review — {self.category} — {self.email}")
        self.root.geometry("1500x950")
        self.root.configure(bg="#1a1a1a")

        # Header
        header = Frame(self.root, bg="#111")
        header.pack(fill=X, padx=0, pady=0)

        Label(header, text=f"Batch: {self.batch_id[:12]}...",
              fg="#c9a94e", bg="#111", font=("Helvetica", 11)).pack(side=LEFT, padx=10)
        Label(header, text=f"Category: {self.category}",
              fg="#fff", bg="#111", font=("Helvetica", 11)).pack(side=LEFT, padx=10)
        Label(header, text=f"User: {self.email}",
              fg="#999", bg="#111", font=("Helvetica", 11)).pack(side=LEFT, padx=10)

        # Image panels
        img_frame = Frame(self.root, bg="#1a1a1a")
        img_frame.pack(expand=True, fill=BOTH, padx=10, pady=5)

        # Left = input jewelry
        left_frame = Frame(img_frame, bg="#222")
        left_frame.pack(side=LEFT, expand=True, fill=BOTH, padx=5)
        Label(left_frame, text="INPUT (Jewelry)", fg="#c9a94e", bg="#222",
              font=("Helvetica", 10, "bold")).pack()
        self.img_label_left = Label(left_frame, bg="#222")
        self.img_label_left.pack(expand=True)

        # Right = output
        right_frame = Frame(img_frame, bg="#222")
        right_frame.pack(side=RIGHT, expand=True, fill=BOTH, padx=5)
        Label(right_frame, text="OUTPUT (Generated)", fg="#c9a94e", bg="#222",
              font=("Helvetica", 10, "bold")).pack()
        self.img_label_right = Label(right_frame, bg="#222")
        self.img_label_right.pack(expand=True)

        # Bottom controls
        bottom = Frame(self.root, bg="#1a1a1a")
        bottom.pack(fill=X, padx=10, pady=5)

        # Counters
        self.counter_label = Label(bottom, fg="#fff", bg="#1a1a1a",
                                    font=("Helvetica", 12))
        self.counter_label.pack()

        self.status_label = Label(bottom, fg="#4a9eff", bg="#1a1a1a",
                                   font=("Helvetica", 10))
        self.status_label.pack()

        self.cost_label = Label(bottom, fg="#c9a94e", bg="#1a1a1a",
                                 font=("Helvetica", 10))
        self.cost_label.pack()

        # Rating
        rating_frame = Frame(bottom, bg="#1a1a1a")
        rating_frame.pack(pady=3)
        Label(rating_frame, text="Rating:", fg="#999", bg="#1a1a1a").pack(side=LEFT)
        for i in range(1, 6):
            Button(rating_frame, text=str(i), width=3,
                   command=lambda v=i: self.set_rating(v)).pack(side=LEFT, padx=2)

        # Action buttons
        btn_frame = Frame(bottom, bg="#1a1a1a")
        btn_frame.pack(pady=5)

        self.pass_btn = Button(btn_frame, text="✅ PASS", bg="#2d7a2d", fg="white",
                                font=("Helvetica", 12, "bold"), width=12,
                                command=self.mark_pass)
        self.pass_btn.pack(side=LEFT, padx=5)

        self.fail_btn = Button(btn_frame, text="❌ FAIL", bg="#7a2d2d", fg="white",
                                font=("Helvetica", 12, "bold"), width=12,
                                command=self.mark_fail)
        self.fail_btn.pack(side=LEFT, padx=5)

        Button(btn_frame, text="📎 Scale Ref", command=self.upload_scale_ref
               ).pack(side=LEFT, padx=5)

        Button(btn_frame, text="🔄 Refresh (F5)", command=self.do_refresh
               ).pack(side=LEFT, padx=5)

        self.deliver_btn = Button(btn_frame, text="📤 Deliver Passed (D)", bg="#1a5a7a",
                                   fg="white", font=("Helvetica", 10, "bold"),
                                   command=self.deliver_passed)
        self.deliver_btn.pack(side=LEFT, padx=5)

        # Passed counter for delivery readiness
        self.passed_label = Label(bottom, fg="#2d7a2d", bg="#1a1a1a",
                                   font=("Helvetica", 10, "bold"))
        self.passed_label.pack()

        # Prompt + regenerate
        prompt_frame = Frame(bottom, bg="#1a1a1a")
        prompt_frame.pack(fill=X, pady=3)
        Label(prompt_frame, text="Correction Prompt:", fg="#999",
              bg="#1a1a1a").pack(anchor=W)
        self.prompt_box = Text(prompt_frame, height=4, bg="#222", fg="#fff",
                                insertbackground="#fff")
        self.prompt_box.pack(fill=X)

        self.regen_btn = Button(bottom, text="🔁 Regenerate", bg="#4a4a00",
                                 fg="white", font=("Helvetica", 11),
                                 command=self.regenerate)
        self.regen_btn.pack(pady=3)

        # Navigation
        nav_frame = Frame(bottom, bg="#1a1a1a")
        nav_frame.pack(pady=3)
        Button(nav_frame, text="◀ Previous", command=self.prev_image).pack(side=LEFT, padx=10)
        Button(nav_frame, text="Next ▶", command=self.next_image).pack(side=RIGHT, padx=10)

        # Keyboard shortcuts
        self.root.bind("<Key>", self.handle_key)

        # Initial load
        if self.current_index is not None:
            self.load_images()
        else:
            if not self.available:
                messagebox.showinfo("Waiting", "No outputs yet. Run step2_generate.py first, then press Refresh.")
            else:
                messagebox.showinfo("Done", "All available images reviewed!")

        self.root.mainloop()

    # ==================== IMAGE LOADING ====================

    def load_images(self):
        if self.current_index is None or self.current_index >= len(self.available):
            return

        image_id = self.available[self.current_index]
        img_meta = self.image_map.get(image_id, {})

        # Counter
        reviewed = sum(1 for r in self.reviews.values() if r.get("status") in ["passed", "failed"])
        total_avail = len(self.available)
        total_all = len(self.all_images)
        self.counter_label.config(
            text=f"Image {self.current_index + 1}/{total_avail} available  |  "
                 f"{reviewed} reviewed  |  {total_all} total in batch"
        )
        self.cost_label.config(text=f"Session Regen Cost: ${self.total_cost:.2f}")

        # Status
        existing = self.reviews.get(image_id, {}).get("status", "unreviewed")
        self.status_label.config(text=f"ID: {image_id[:12]}...  |  Seq: {img_meta.get('sequence_number', '?')}  |  Status: {existing}")

        # Load input
        input_path = self.batch_dir / img_meta.get("local_input", f"inputs/{image_id}.jpg")
        if input_path.exists():
            img1 = Image.open(input_path)
            img1.thumbnail((650, 750))
            tk1 = ImageTk.PhotoImage(img1)
            self.img_label_left.config(image=tk1)
            self.img_label_left.image = tk1
        else:
            self.img_label_left.config(image="", text="Input not found", fg="red")

        # Load output
        output_path = self.outputs_dir / f"{image_id}.jpg"
        if not output_path.exists():
            # Try other extensions
            for ext in [".png", ".jpeg", ".webp"]:
                alt = self.outputs_dir / f"{image_id}{ext}"
                if alt.exists():
                    output_path = alt
                    break

        if output_path.exists():
            img2 = Image.open(output_path)
            img2.thumbnail((650, 750))
            tk2 = ImageTk.PhotoImage(img2)
            self.img_label_right.config(image=tk2)
            self.img_label_right.image = tk2
        else:
            self.img_label_right.config(image="", text="Output not found", fg="red")

    # ==================== ACTIONS ====================

    def get_passed_count(self):
        return sum(1 for r in self.reviews.values() if r.get("status") == "passed")

    def update_passed_label(self):
        passed = self.get_passed_count()
        total_reviewed = sum(1 for r in self.reviews.values() if r.get("status") in ["passed", "failed"])
        if passed > 0:
            self.passed_label.config(
                text=f"✅ {passed} passed — ready to deliver  |  {total_reviewed} reviewed total"
            )
        else:
            self.passed_label.config(text="")

    def mark_pass(self):
        if self.current_index is None:
            return
        image_id = self.available[self.current_index]
        self.reviews.setdefault(image_id, {})
        self.reviews[image_id]["status"] = "passed"
        self.reviews[image_id]["reviewed_at"] = datetime.datetime.now().isoformat()
        self.save_reviews()
        self.update_passed_label()

        # Check if all available images are reviewed
        unreviewed = sum(
            1 for iid in self.available
            if self.reviews.get(iid, {}).get("status") not in ["passed", "failed"]
        )
        if unreviewed == 0 and self.get_passed_count() > 0:
            if messagebox.askyesno(
                "All Reviewed",
                f"All {len(self.available)} images reviewed.\n"
                f"{self.get_passed_count()} passed.\n\n"
                f"Deliver passed images now?"
            ):
                self.deliver_passed()
                return

        self.next_image()

    def mark_fail(self):
        if self.current_index is None:
            return
        image_id = self.available[self.current_index]
        self.reviews.setdefault(image_id, {})
        self.reviews[image_id]["status"] = "failed"
        self.reviews[image_id]["reviewed_at"] = datetime.datetime.now().isoformat()
        self.save_reviews()
        self.update_passed_label()
        self.next_image()

    def set_rating(self, val):
        if self.current_index is None:
            return
        image_id = self.available[self.current_index]
        self.reviews.setdefault(image_id, {})
        self.reviews[image_id]["rating"] = val
        self.save_reviews()

    def upload_scale_ref(self):
        if self.current_index is None:
            return
        file_path = filedialog.askopenfilename(
            filetypes=[("Image files", "*.jpg *.jpeg *.png *.webp")]
        )
        if not file_path:
            return

        image_id = self.available[self.current_index]
        scale_dir = self.batch_dir / "scale_refs"
        scale_dir.mkdir(exist_ok=True)
        dest = scale_dir / f"{image_id}.jpg"
        Image.open(file_path).save(dest)

        self.reviews.setdefault(image_id, {})
        self.reviews[image_id]["scale_reference"] = str(dest)
        self.reviews[image_id]["scale_issue"] = True
        self.save_reviews()
        messagebox.showinfo("Saved", "Scale reference saved.")

    def do_refresh(self):
        """Re-scan outputs folder for newly generated images."""
        old_count = len(self.available)
        self.refresh_available()
        new_count = len(self.available)
        diff = new_count - old_count

        if self.current_index is None:
            self.current_index = self.find_first_unreviewed()

        if self.current_index is not None:
            self.load_images()

        self.update_passed_label()
        self.status_label.config(
            text=f"Refreshed: {new_count} outputs available (+{diff} new)"
        )

    # ==================== DELIVERY (inline) ====================

    def deliver_passed(self):
        """Upload all passed images to Azure and trigger delivery via API."""
        passed_ids = [
            iid for iid, r in self.reviews.items()
            if r.get("status") == "passed" and iid in self.image_map
        ]

        if not passed_ids:
            messagebox.showinfo("Nothing to deliver", "No passed images to deliver.")
            return

        if not messagebox.askyesno(
            "Confirm Delivery",
            f"Deliver {len(passed_ids)} passed images?\n\n"
            f"This will upload to Azure, create delivery records,\n"
            f"and send the email to: {self.metadata.get('notification_email') or self.email}"
        ):
            return

        threading.Thread(target=self._run_delivery, args=(passed_ids,), daemon=True).start()

    def _run_delivery(self, passed_ids):
        self.disable_buttons()
        self.deliver_btn.config(state=DISABLED)

        try:
            # Init Azure
            blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
            container = blob_service.get_container_client(AZURE_CONTAINER)
            account_name = blob_service.account_name

            delivery_images = []

            for i, image_id in enumerate(passed_ids, 1):
                self.status_label.config(text=f"Uploading {i}/{len(passed_ids)}...")
                self.root.update_idletasks()

                img_meta = self.image_map[image_id]
                seq = img_meta.get("sequence_number", 0)

                # Find output file
                output_path = self.outputs_dir / f"{image_id}.jpg"
                if not output_path.exists():
                    for ext in [".png", ".jpeg", ".webp"]:
                        alt = self.outputs_dir / f"{image_id}{ext}"
                        if alt.exists():
                            output_path = alt
                            break

                if not output_path.exists():
                    self.status_label.config(text=f"Missing output for {image_id[:8]}...")
                    continue

                # Upload to Azure
                blob_name = f"deliveries/{self.batch_id}/{image_id}{output_path.suffix}"
                blob_client = container.get_blob_client(blob_name)

                with open(output_path, "rb") as data:
                    blob_client.upload_blob(data, overwrite=True)

                azure_url = f"https://{account_name}.blob.core.windows.net/{AZURE_CONTAINER}/{blob_name}"

                delivery_images.append({
                    "image_id": image_id,
                    "result_url": azure_url,
                    "filename": f"{self.category}_{seq}_{image_id[:8]}.jpg",
                })

            if not delivery_images:
                self.status_label.config(text="No images uploaded. Delivery cancelled.")
                self.enable_buttons()
                self.deliver_btn.config(state=NORMAL)
                return

            # Call deliver API
            self.status_label.config(text=f"Triggering delivery for {len(delivery_images)} images...")
            self.root.update_idletasks()

            result = api_deliver(self.batch_id, delivery_images)

            # Save delivered.json locally
            delivered_path = self.batch_dir / "delivered.json"
            with open(delivered_path, "w") as f:
                json.dump({
                    "delivered_at": datetime.datetime.now().isoformat(),
                    "token": result.get("token"),
                    "delivery_url": result.get("delivery_url"),
                    "images_delivered": len(delivery_images),
                    "email_sent": result.get("email_sent"),
                }, f, indent=2)

            email_status = "✓ Email sent" if result.get("email_sent") else "⚠ Email failed"
            url = result.get("delivery_url", "")

            messagebox.showinfo(
                "Delivery Complete",
                f"✅ {len(delivery_images)} images delivered!\n\n"
                f"{email_status}\n"
                f"URL: {url}"
            )

            self.status_label.config(
                text=f"✅ Delivered {len(delivery_images)} images | {email_status}"
            )

        except Exception as e:
            messagebox.showerror("Delivery Failed", str(e))
            self.status_label.config(text=f"✗ Delivery error: {str(e)[:80]}")

        self.enable_buttons()
        self.deliver_btn.config(state=NORMAL)

    # ==================== NAVIGATION ====================

    def next_image(self):
        if self.current_index is None:
            return
        for i in range(self.current_index + 1, len(self.available)):
            status = self.reviews.get(self.available[i], {}).get("status")
            if status not in ["passed", "failed"]:
                self.current_index = i
                self.load_images()
                return
        messagebox.showinfo("Done", "All available images reviewed!")

    def prev_image(self):
        if self.current_index is None:
            return
        for i in range(self.current_index - 1, -1, -1):
            self.current_index = i
            self.load_images()
            return

    # ==================== REGENERATION ====================

    def regenerate(self):
        threading.Thread(target=self._run_regen, daemon=True).start()

    def _run_regen(self):
        if self.current_index is None:
            return

        image_id = self.available[self.current_index]
        img_meta = self.image_map.get(image_id, {})

        # Don't regen locked images
        if self.reviews.get(image_id, {}).get("status") in ["passed", "failed"]:
            self.status_label.config(text="Image locked (already reviewed)")
            return

        input_path = self.batch_dir / img_meta.get("local_input", f"inputs/{image_id}.jpg")
        output_path = self.outputs_dir / f"{image_id}.jpg"

        if not output_path.exists():
            self.status_label.config(text="No output to modify yet")
            return

        prompt_text = self.prompt_box.get("1.0", END).strip()
        if not prompt_text:
            self.status_label.config(text="Enter a correction prompt first")
            return

        self.disable_buttons()
        self.status_label.config(text="Regenerating...")

        try:
            input_bytes = open(input_path, "rb").read()
            output_bytes = open(output_path, "rb").read()

            parts = [
                types.Part.from_text(text=f"""
Correct this AI generated image.

Image 1 = Original Input (jewelry reference).
Image 2 = Current Output (needs correction).

Fix according to:
{prompt_text}
"""),
                types.Part.from_text(text="Image 1"),
                types.Part.from_bytes(mime_type="image/jpeg", data=input_bytes),
                types.Part.from_text(text="Image 2"),
                types.Part.from_bytes(mime_type="image/jpeg", data=output_bytes),
            ]

            # Add scale reference if available
            scale_ref = self.reviews.get(image_id, {}).get("scale_reference")
            if scale_ref and Path(scale_ref).exists():
                scale_bytes = open(scale_ref, "rb").read()
                parts.append(types.Part.from_text(text="Scale Reference"))
                parts.append(types.Part.from_bytes(mime_type="image/jpeg", data=scale_bytes))

            contents = [types.Content(role="user", parts=parts)]
            config = types.GenerateContentConfig(response_modalities=["IMAGE"])

            image_bytes = None
            for chunk in client.models.generate_content_stream(
                model=GEMINI_MODEL, contents=contents, config=config
            ):
                self.root.update_idletasks()
                if not hasattr(chunk, "candidates") or not chunk.candidates:
                    continue
                candidate = chunk.candidates[0]
                if not candidate.content or not candidate.content.parts:
                    continue
                for part in candidate.content.parts:
                    if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
                        data = part.inline_data.data
                        image_bytes = base64.b64decode(data) if isinstance(data, str) else bytes(data)

            if not image_bytes:
                self.status_label.config(text="No image returned from Gemini")
                self.enable_buttons()
                return

            # Save backup
            backup = self.outputs_dir / f"{image_id}_backup.jpg"
            if output_path.exists():
                output_path.replace(backup)

            with open(output_path, "wb") as f:
                f.write(image_bytes)

            # Track regen
            self.reviews.setdefault(image_id, {})
            self.reviews[image_id]["regen_count"] = self.reviews[image_id].get("regen_count", 0) + 1
            self.reviews[image_id]["last_regenerated_at"] = datetime.datetime.now().isoformat()
            self.reviews[image_id]["estimated_cost"] = self.reviews[image_id].get("estimated_cost", 0) + COST_PER_GENERATION
            self.total_cost += COST_PER_GENERATION
            self.save_reviews()

            self.status_label.config(text="✓ Regeneration complete")
            self.load_images()

        except Exception as e:
            self.status_label.config(text=f"Error: {str(e)[:80]}")

        self.enable_buttons()

    def disable_buttons(self):
        self.pass_btn.config(state=DISABLED)
        self.fail_btn.config(state=DISABLED)
        self.regen_btn.config(state=DISABLED)

    def enable_buttons(self):
        self.pass_btn.config(state=NORMAL)
        self.fail_btn.config(state=NORMAL)
        self.regen_btn.config(state=NORMAL)

    # ==================== KEYBOARD ====================

    def handle_key(self, event):
        focused = self.root.focus_get()
        if isinstance(focused, Text):
            return

        key = event.keysym
        if key == "Return":
            self.mark_pass()
        elif key == "BackSpace":
            self.mark_fail()
        elif key == "Right":
            self.next_image()
        elif key == "Left":
            self.prev_image()
        elif key.lower() == "r":
            self.regenerate()
        elif key.lower() == "d":
            self.deliver_passed()
        elif key == "F5":
            self.do_refresh()
        elif key in ["1", "2", "3", "4", "5"]:
            self.set_rating(int(key))


# ==================== MAIN ====================

if __name__ == "__main__":
    batch_dir = select_batch()
    print(f"Opening QA for: {batch_dir.name}")
    ReviewApp(batch_dir)
