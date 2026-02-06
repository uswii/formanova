"""
============================================================
CONFIGURATION SETTINGS FOR TEMPORAL BACKEND
============================================================

PURPOSE:
Central configuration for all environment variables used by the Temporal
backend services. Loaded once at startup from environment variables.

SERVICES THIS CONFIGURES:
- Temporal Server connection (workflow orchestration)
- PostgreSQL database (user data, credits, generations)
- Azure Blob Storage (image storage)
- ML microservices (BiRefNet, SAM3, Flux-Fill)
- A100 GPU server (heavy ML inference)

ENVIRONMENT VARIABLES:
All values are read from environment variables with sensible defaults.
In production, set these via Docker/kubernetes secrets or .env file.

EXAMPLE .env:
    TEMPORAL_ADDRESS=temporal:7233
    DATABASE_URL=postgresql://user:pass@host:5432/formanova
    AZURE_ACCOUNT_NAME=formanovastorage
    AZURE_ACCOUNT_KEY=your-key-here
"""
import os
from dataclasses import dataclass


@dataclass
class Config:
    """Application configuration loaded from environment variables."""
    
    # ========== Temporal Workflow Engine ==========
    # Temporal orchestrates the multi-step jewelry generation workflow
    temporal_address: str = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
    temporal_namespace: str = os.getenv("TEMPORAL_NAMESPACE", "default")
    
    # ========== PostgreSQL Database ==========
    # Stores users, credits, payments, and generation history
    # Can use individual params OR a connection URL
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", "5432"))
    db_name: str = os.getenv("DB_NAME", "formanova")
    db_user: str = os.getenv("DB_USER", "postgres")
    db_password: str = os.getenv("DB_PASSWORD", "")
    database_url: str = os.getenv("DATABASE_URL", "")  # Full connection URL (preferred)
    
    # ========== Azure Blob Storage ==========
    # All images (uploads, masks, results) are stored in Azure
    # Frontend fetches images via SAS URLs for security
    azure_account_name: str = os.getenv("AZURE_ACCOUNT_NAME", "")
    azure_account_key: str = os.getenv("AZURE_ACCOUNT_KEY", "")
    azure_container_name: str = os.getenv("AZURE_CONTAINER_NAME", "jewelry-uploads")
    
    # ========== External ML Microservices ==========
    # These are Modal.com hosted services for ML inference
    image_manipulator_url: str = os.getenv("IMAGE_MANIPULATOR_URL", "http://20.106.235.80:8005")
    birefnet_url: str = os.getenv("BIREFNET_URL", "https://nemoooooooooo--bg-remove-service-fastapi-app.modal.run")  # Background removal
    sam3_url: str = os.getenv("SAM3_URL", "https://nemoooooooooo--sam3-service-fastapi-app.modal.run")  # Segment Anything Model
    flux_fill_url: str = os.getenv("FLUX_FILL_URL", "https://nemoooooooooo--flux-fill-service-fastapi-app.modal.run")  # Image inpainting
    a100_server_url: str = os.getenv("A100_SERVER_URL", "http://localhost:8000")  # A100 GPU for heavy inference
    
    # ========== Email Service (Resend) ==========
    # Used for batch completion notifications
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    email_from_address: str = os.getenv("EMAIL_FROM_ADDRESS", "noreply@formanova.com")
    frontend_url: str = os.getenv("FRONTEND_URL", "https://formanova.ai")
    
    # ========== Auth Service ==========
    auth_service_url: str = os.getenv("AUTH_SERVICE_URL", "http://20.157.122.64:8002")
    
    # ========== API Server ==========
    api_port: int = int(os.getenv("API_PORT", "8001"))
    
    # ========== Temporal Task Queues ==========
    # Different queues for different workload types
    main_task_queue: str = "jewelry-generation"      # Main orchestration
    image_processing_queue: str = "image-processing" # CPU-bound image ops
    ml_inference_queue: str = "ml-inference"         # GPU-bound ML inference
    batch_processing_queue: str = "batch-processing" # Bulk upload processing


# Global config instance - import this in other modules
config = Config()

