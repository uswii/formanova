"""Temporal activities for batch processing and email notifications."""
import logging
from dataclasses import dataclass
from typing import Optional, List
from uuid import UUID

import httpx
from temporalio import activity

from .config import config

logger = logging.getLogger(__name__)

# HTTP client for external services
http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))


@dataclass
class SendBatchEmailInput:
    """Input for sending batch completion email."""
    user_email: str
    user_name: str
    batch_id: str
    total_images: int
    completed_images: int
    failed_images: int
    jewelry_category: str
    download_url: str  # URL to view/download results


@dataclass
class SendBatchEmailOutput:
    """Output from sending batch completion email."""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


@dataclass
class FetchUserInfoInput:
    """Input for fetching user info from auth service."""
    user_id: str


@dataclass 
class FetchUserInfoOutput:
    """Output from fetching user info."""
    email: str
    name: str
    tenant_id: str


@activity.defn
async def send_batch_completion_email(input: SendBatchEmailInput) -> SendBatchEmailOutput:
    """Send email notification when batch processing completes."""
    if not config.resend_api_key:
        activity.logger.warning("RESEND_API_KEY not configured, skipping email")
        return SendBatchEmailOutput(success=False, error="Email not configured")
    
    try:
        # Determine if batch was fully successful or had failures
        status_text = "completed successfully" if input.failed_images == 0 else "completed with some failures"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #C9A55C;">Your Batch Processing is Complete!</h1>
            
            <p>Hi there,</p>
            
            <p>Great news! Your <strong>{input.jewelry_category}</strong> batch has {status_text}.</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Batch Summary</h3>
                <ul style="list-style: none; padding: 0;">
                    <li>✅ <strong>Completed:</strong> {input.completed_images} images</li>
                    {"<li>❌ <strong>Failed:</strong> " + str(input.failed_images) + " images</li>" if input.failed_images > 0 else ""}
                    <li>📊 <strong>Total:</strong> {input.total_images} images</li>
                </ul>
            </div>
            
            <a href="{input.download_url}" 
               style="display: inline-block; background: #C9A55C; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                View & Download Results
            </a>
            
            <p style="color: #666; margin-top: 30px; font-size: 14px;">
                If you have any questions, please contact our support team.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px;">
                FormaNova - AI Jewelry Photography
            </p>
        </div>
        """
        
        response = await http_client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {config.resend_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": config.email_from_address,
                "to": [input.user_email],
                "subject": f"Your {input.jewelry_category} batch is ready! 🎉",
                "html": html_content
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            activity.logger.info(f"✓ Batch completion email sent to {input.user_email}")
            return SendBatchEmailOutput(success=True, message_id=data.get("id"))
        else:
            error = f"Resend API error: {response.status_code} - {response.text}"
            activity.logger.error(f"✗ {error}")
            return SendBatchEmailOutput(success=False, error=error)
            
    except Exception as e:
        error = f"Failed to send email: {str(e)}"
        activity.logger.error(f"✗ {error}")
        return SendBatchEmailOutput(success=False, error=error)


@activity.defn
async def fetch_user_info(input: FetchUserInfoInput) -> FetchUserInfoOutput:
    """Fetch user info from auth service to get email for notifications."""
    try:
        response = await http_client.get(
            f"{config.auth_service_url}/users/{input.user_id}",
            timeout=httpx.Timeout(10.0)
        )
        response.raise_for_status()
        data = response.json()
        
        activity.logger.info(f"✓ Fetched user info for {input.user_id}")
        
        return FetchUserInfoOutput(
            email=data.get("email", ""),
            name=data.get("name", data.get("display_name", "User")),
            tenant_id=data.get("tenant_id", "default")
        )
    except Exception as e:
        activity.logger.error(f"✗ Failed to fetch user info: {e}")
        raise


@activity.defn
async def send_batch_started_email(input: SendBatchEmailInput) -> SendBatchEmailOutput:
    """Send email notification when batch processing starts."""
    if not config.resend_api_key:
        return SendBatchEmailOutput(success=False, error="Email not configured")
    
    try:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #C9A55C;">Your Batch is Being Processed!</h1>
            
            <p>Hi there,</p>
            
            <p>We've started processing your <strong>{input.jewelry_category}</strong> batch with 
               <strong>{input.total_images}</strong> images.</p>
            
            <p>We'll send you another email when it's complete. This usually takes 5-15 minutes 
               depending on the number of images.</p>
            
            <a href="{input.download_url}" 
               style="display: inline-block; background: #C9A55C; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Track Progress
            </a>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px;">
                FormaNova - AI Jewelry Photography
            </p>
        </div>
        """
        
        response = await http_client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {config.resend_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": config.email_from_address,
                "to": [input.user_email],
                "subject": f"Processing your {input.jewelry_category} batch... ⏳",
                "html": html_content
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            activity.logger.info(f"✓ Batch started email sent to {input.user_email}")
            return SendBatchEmailOutput(success=True, message_id=data.get("id"))
        else:
            return SendBatchEmailOutput(success=False, error=f"API error: {response.status_code}")
            
    except Exception as e:
        return SendBatchEmailOutput(success=False, error=str(e))
