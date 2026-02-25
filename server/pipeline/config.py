"""
Pipeline configuration — loads from .env file.
Copy .env.example → .env and fill in your values.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ==================== API ====================

PIPELINE_API_URL = os.getenv(
    "PIPELINE_API_URL",
    "https://volhgtspbvgxavqgueqc.supabase.co/functions/v1/pipeline-api"
)
PIPELINE_API_KEY = os.getenv("PIPELINE_API_KEY", "")

# ==================== AZURE ====================

AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING", "")
AZURE_CONTAINER = os.getenv("AZURE_CONTAINER", "agentic-artifacts")

# ==================== GEMINI ====================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-pro-image-preview")

# ==================== PATHS ====================

MODEL_FOLDER = Path(os.getenv("MODEL_FOLDER", "./models"))
WORKSPACE = Path(os.getenv("WORKSPACE", "./workspace"))

# Ensure directories exist
WORKSPACE.mkdir(parents=True, exist_ok=True)
MODEL_FOLDER.mkdir(parents=True, exist_ok=True)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# ==================== PROMPTS (per category) ====================

CATEGORY_PROMPTS = {
    "necklace": """
You are performing controlled jewelry placement.

Image 1 is the BASE MODEL.
Image 2 is the REFERENCE NECKLACE.

Extract the jewelry from Image 2.
Place it naturally on Image 1.

Preserve exact jewelry geometry. Do not redesign or extend it.

Generate professional high definition images, 8k, ultra real.
No blurry jewelry. High realism.
Remove any extra jewelry not in input image.
Adjust model styling and dress colors to complement jewelry.

If input has earrings, output must have same earrings.
You may change pose subtly to showcase necklace.
Do NOT overscale necklace. Keep real-world proportions.
No text overlays. Take care of scale carefully.
""",

    "earring": """
You are performing controlled jewelry placement.

Image 1 is the BASE MODEL.
Image 2 is the REFERENCE EARRING(S).

Extract the earring(s) from Image 2.
Place them naturally on Image 1's ears.

Preserve exact earring geometry. Do not redesign.
Generate professional high definition images, 8k, ultra real.
No blurry jewelry. High realism.
Remove any extra jewelry not in input image.
Keep real-world proportions. No text overlays.
""",

    "bracelet": """
You are performing controlled jewelry placement.

Image 1 is the BASE MODEL.
Image 2 is the REFERENCE BRACELET.

Extract the bracelet from Image 2.
Place it naturally on Image 1's wrist.

Preserve exact bracelet geometry. Do not redesign.
Generate professional high definition images, 8k, ultra real.
No blurry jewelry. High realism.
Remove any extra jewelry not in input image.
Keep real-world proportions. No text overlays.
""",

    "ring": """
You are performing controlled jewelry placement.

Image 1 is the BASE MODEL.
Image 2 is the REFERENCE RING.

Extract the ring from Image 2.
Place it naturally on Image 1's finger.

Preserve exact ring geometry. Do not redesign.
Generate professional high definition images, 8k, ultra real.
No blurry jewelry. High realism.
Remove any extra jewelry not in input image.
Keep real-world proportions. No text overlays.
""",

    "watch": """
You are performing controlled jewelry placement.

Image 1 is the BASE MODEL.
Image 2 is the REFERENCE WATCH.

Extract the watch from Image 2.
Place it naturally on Image 1's wrist.

Preserve exact watch geometry. Do not redesign.
Generate professional high definition images, 8k, ultra real.
No blurry details. High realism.
Keep real-world proportions. No text overlays.
""",
}
