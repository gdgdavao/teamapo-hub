"""
Email service module using Resend for sending transactional emails.
Handles all email notifications for the ApoHub application.
"""

import os
import logging
import re
import smtplib
import base64
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional, List, cast
from datetime import datetime
import resend
from pathlib import Path
from email_template_loader import template_loader

# Configure logging
logger = logging.getLogger(__name__)

def sanitize_tag_value(value: str) -> str:
    """
    Sanitize tag value to only contain ASCII letters, numbers, underscores, or dashes.
    Resend API requires tag values to follow this format.
    """
    if not value:
        return ""
    
    # Replace spaces and special characters with underscores
    # Keep only ASCII letters, numbers, underscores, and dashes
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '_', str(value))
    
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Remove leading/trailing underscores
    sanitized = sanitized.strip('_')
    
    # Ensure it's not empty and not too long (Resend has limits)
    if not sanitized:
        sanitized = "unknown"
    
    # Truncate if too long (Resend typically has a 50 character limit for tag values)
    if len(sanitized) > 50:
        sanitized = sanitized[:50].rstrip('_')
    
    return sanitized

def load_env_file():
    """Load environment variables from .env file in functions directory or project root."""
    functions_env = Path(__file__).resolve().parent / '.env'
    root_env = Path(__file__).resolve().parent.parent / '.env'
    target_env = functions_env if functions_env.exists() else root_env
    if target_env.exists():
        with open(target_env, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

class EmailService:
    """Service for sending emails using Resend API."""
    
    def __init__(self):
        """Initialize the email service with Resend API key."""
        # Try to load from .env file first
        load_env_file()
        
        # Try different sources for the API key
        self.api_key = (
            os.getenv('RESEND_API_KEY') or 
            os.getenv('RESEND_API_KEY'.lower()) or
            self._get_firebase_config('resend.api_key')
        )
        
        if not self.api_key:
            logger.warning("RESEND_API_KEY not found in environment variables or Firebase config")
            logger.info("Please set RESEND_API_KEY environment variable or use: firebase functions:config:set resend.api_key=your_key")
            # For development, you might want to use a default key or skip sending
            self.api_key = "re_development_key"  # This will fail in production
        
        resend.api_key = self.api_key
        
        self.from_email = (
            os.getenv('FROM_EMAIL') or 
            os.getenv('FROM_EMAIL'.lower()) or
            self._get_firebase_config('resend.from_email') or
            'teamapohub@gdgdavao.org'
        )
        
        # Set sender display name
        self.sender_name = (
            os.getenv('SENDER_NAME') or 
            os.getenv('SENDER_NAME'.lower()) or
            self._get_firebase_config('resend.sender_name') or
            'TeamApo Hub - GDG Davao'
        )
        
        # Format the complete "from" field with display name
        self.from_address = f"{self.sender_name} <{self.from_email}>"
        
        # Check if Mailpit mode is requested or configured
        self.use_mailpit = (
            os.getenv('USE_MAILPIT', '').lower() in ('true', '1') or
            os.getenv('MAILPIT_ENABLED', '').lower() in ('true', '1')
        )
        self.mailpit_host = os.getenv('MAILPIT_SMTP_HOST', 'localhost')
        self.mailpit_port = int(os.getenv('MAILPIT_SMTP_PORT', '1025'))
        
        if self.use_mailpit:
            logger.info(f"Mailpit dev mode active. Routing emails to SMTP {self.mailpit_host}:{self.mailpit_port}")
        
        logger.info(f"Email service initialized with sender: {self.from_address}")
        if self.api_key.startswith('re_'):
            logger.info(f"Using Resend API key: {self.api_key[:10]}...")
        else:
            logger.warning("Invalid or missing Resend API key")
    
    def _get_firebase_config(self, key: str) -> Optional[str]:
        """Get configuration from Firebase Functions config."""
        try:
            # This would work in deployed functions
            import firebase_functions
            config = firebase_functions.config()
            keys = key.split('.')
            value = config
            for k in keys:
                value = getattr(value, k, None)
                if value is None:
                    return None
            return value
        except:
            return None
    
    def _send_via_smtp(
        self,
        to: str | List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        tags: Optional[List[Dict[str, str]]] = None,
        attachments: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Send email via SMTP (e.g. Mailpit for local development)."""
        try:
            recipients = [to] if isinstance(to, str) else to
            
            # Create root multipart message
            msg = MIMEMultipart('related')
            msg['Subject'] = subject
            msg['From'] = self.from_address
            msg['To'] = ", ".join(recipients)
            if reply_to:
                msg['Reply-To'] = reply_to
            
            # Alternative part for text and HTML
            alt_part = MIMEMultipart('alternative')
            if text_content:
                alt_part.attach(MIMEText(text_content, 'plain', 'utf-8'))
            alt_part.attach(MIMEText(html_content, 'html', 'utf-8'))
            msg.attach(alt_part)
            
            # Handle attachments (including inline CID images)
            if attachments:
                for att in attachments:
                    filename = att.get('filename', 'attachment')
                    content = att.get('content', '')
                    content_id = att.get('content_id')
                    
                    try:
                        file_data = base64.b64decode(content)
                    except Exception:
                        file_data = content.encode('utf-8') if isinstance(content, str) else content
                    
                    mime_att = MIMEBase('application', 'octet-stream')
                    mime_att.set_payload(file_data)
                    encoders.encode_base64(mime_att)
                    
                    if content_id:
                        mime_att.add_header('Content-ID', f"<{content_id}>")
                        mime_att.add_header('Content-Disposition', f'inline; filename="{filename}"')
                    else:
                        mime_att.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                    
                    msg.attach(mime_att)
            
            with smtplib.SMTP(self.mailpit_host, self.mailpit_port) as server:
                server.send_message(msg)
            
            msg_id = f"mailpit_{int(time.time() * 1000)}"
            logger.info(f"Email sent via Mailpit to {recipients}: {msg_id}")
            return {
                "success": True,
                "message": "Email sent successfully via Mailpit",
                "email_id": msg_id,
                "recipient": to
            }
        except Exception as e:
            logger.error(f"Failed to send email via Mailpit to {to}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send email via Mailpit: {str(e)}",
                "recipient": to
            }
    
    def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        tags: Optional[List[Dict[str, str]]] = None,
        attachments: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Send an email using Mailpit (if USE_MAILPIT=true) or Resend API.
        
        Args:
            to: Recipient email address(es)
            subject: Email subject
            html_content: HTML content of the email
            text_content: Plain text content (optional)
            reply_to: Reply-to email address (optional)
            tags: List of tags for tracking (optional)
            attachments: List of attachments with filename, content, and optional content_id (optional)
            
        Returns:
            Dict containing success status and message/error
        """
        if self.use_mailpit:
            return self._send_via_smtp(
                to=to,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                reply_to=reply_to,
                tags=tags,
                attachments=attachments
            )
        
        try:
            # Prepare email data
            email_data = {
                "from": self.from_address,
                "to": to if isinstance(to, list) else [to],
                "subject": subject,
                "html": html_content,
            }
            
            if text_content:
                email_data["text"] = text_content
            
            if reply_to:
                email_data["reply_to"] = reply_to
            
            if tags:
                email_data["tags"] = tags
            
            if attachments:
                email_data["attachments"] = attachments
            
            # Send email
            # email_data is built by mutation, so it stays dict[str, Unknown] and
            # cannot be checked structurally against resend's SendParams TypedDict.
            response = resend.Emails.send(cast('resend.Emails.SendParams', email_data))
            
            logger.info(f"Email sent successfully to {to}: {response.get('id', 'unknown_id')}")
            
            return {
                "success": True,
                "message": "Email sent successfully",
                "email_id": response.get("id"),
                "recipient": to
            }
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send email: {str(e)}",
                "recipient": to
            }
    
    def send_registration_confirmation(
        self,
        user_email: str,
        user_name: str,
        event_title: str,
        event_date: str,
        event_location: str,
        registration_id: Optional[str] = None,
        qr_code_data: Optional[str] = None,
        requires_payment: bool = False,
        is_free_registration: Optional[bool] = None,
        maps_url: Optional[str] = None,
        location_tba: bool = False,
        speakers_tba: bool = False
    ) -> Dict[str, Any]:
        """Send registration confirmation email."""
        if is_free_registration is None:
            is_free_registration = not requires_payment
        
        # Auto-detect location TBA from flag or string value
        norm_location = (event_location or '').strip().lower()
        if location_tba or norm_location in ('tbd', 'tba', 'to be announced', 'venue tba', 'venue: to be announced'):
            location_tba = True
            maps_url = None

        # Different subject based on whether registration is approved or just submitted
        if registration_id and qr_code_data:
            subject = f"Registration Approved - {event_title}"
        else:
            subject = f"Registration Submitted - {event_title}"
        
        # Create HTML content
        html_content = self._create_registration_confirmation_html(
            user_name=user_name,
            event_title=event_title,
            event_date=event_date,
            event_location=event_location,
            registration_id=registration_id,
            qr_code_data=qr_code_data,
            requires_payment=requires_payment,
            is_free_registration=is_free_registration,
            maps_url=maps_url,
            location_tba=location_tba,
            speakers_tba=speakers_tba
        )
        
        # Create text content
        text_content = self._create_registration_confirmation_text(
            user_name=user_name,
            event_title=event_title,
            event_date=event_date,
            event_location=event_location,
            registration_id=registration_id,
            requires_payment=requires_payment,
            is_free_registration=is_free_registration,
            maps_url=maps_url,
            location_tba=location_tba,
            speakers_tba=speakers_tba
        )
        
        tags = [
            {"name": "type", "value": "registration_confirmation"},
            {"name": "event", "value": sanitize_tag_value(event_title)},
            {"name": "registration_id", "value": sanitize_tag_value(registration_id or "submitted")}
        ]
        
        return self.send_email(
            to=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            tags=tags
        )
    
    def send_payment_notification(
        self,
        user_email: str,
        user_name: str,
        event_title: str,
        registration_id: str,
        status: str,  # 'approved', 'rejected', 'pending'
        payment_instructions: Optional[str] = None,
        qr_code_data: Optional[str] = None,
        is_free_registration: bool = False
    ) -> Dict[str, Any]:
        """Send payment status notification email (or registration-focused copy for free events)."""
        
        if status == 'pending':
            logger.info(
                f"Skipping payment notification for pending status (registration_id: {registration_id}) "
                "- pending payment emails are discontinued."
            )
            return {
                'success': True,
                'message_id': None,
                'skipped': True,
                'message': 'Pending payment emails are discontinued.'
            }
        
        status_messages = {
            'approved': 'Registration Approved',
            'rejected': 'Payment Rejected',
            'pending': 'Payment Pending'
        }
        free_status_subjects = {
            'approved': 'Registration Approved',
            'rejected': 'Registration Update',
            'pending': 'Registration Pending'
        }
        
        if is_free_registration:
            subject = f"{free_status_subjects.get(status, 'Registration Update')} - {event_title}"
        else:
            subject = f"{status_messages.get(status, 'Registration Update')} - {event_title}"
        
        html_content = self._create_payment_notification_html(
            user_name=user_name,
            event_title=event_title,
            registration_id=registration_id,
            status=status,
            payment_instructions=payment_instructions,
            qr_code_data=qr_code_data,
            use_cid=bool(qr_code_data),  # Use CID for attachment if QR code exists
            is_free_registration=is_free_registration
        )
        
        text_content = self._create_payment_notification_text(
            user_name=user_name,
            event_title=event_title,
            registration_id=registration_id,
            status=status,
            payment_instructions=payment_instructions,
            is_free_registration=is_free_registration
        )
        
        tags = [
            {"name": "type", "value": "payment_notification"},
            {"name": "status", "value": sanitize_tag_value(status)},
            {"name": "event", "value": sanitize_tag_value(event_title)},
            {"name": "registration_id", "value": sanitize_tag_value(registration_id)},
            {"name": "free_registration", "value": "true" if is_free_registration else "false"}
        ]
        
        # Prepare attachments if QR code exists
        attachments = []
        if qr_code_data and status == 'approved':
            attachments = [{
                "filename": "qr_code.png",
                "content": qr_code_data,
                "content_id": "qr_code_cid"
            }]
        
        return self.send_email(
            to=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            tags=tags,
            attachments=attachments if attachments else None
        )
    
    def send_certificate_notification(
        self,
        user_email: str,
        user_name: str,
        event_title: str,
        certificate_url: str,
        registration_id: str
    ) -> Dict[str, Any]:
        """Send certificate ready notification email."""
        
        subject = f"Your Certificate is Ready - {event_title}"
        
        html_content = self._create_certificate_notification_html(
            user_name=user_name,
            event_title=event_title,
            certificate_url=certificate_url
        )
        
        text_content = self._create_certificate_notification_text(
            user_name=user_name,
            event_title=event_title,
            certificate_url=certificate_url
        )
        
        tags = [
            {"name": "type", "value": "certificate_notification"},
            {"name": "event", "value": sanitize_tag_value(event_title)},
            {"name": "registration_id", "value": sanitize_tag_value(registration_id)}
        ]
        
        return self.send_email(
            to=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            tags=tags
        )
    
    def send_event_reminder(
        self,
        user_email: str,
        user_name: str,
        event_title: str,
        event_date: str,
        event_location: str,
        registration_id: str,
        reminder_type: str = "24h",  # "24h" or "1h"
        maps_url: Optional[str] = None,
        location_tba: bool = False,
        speakers_tba: bool = False
    ) -> Dict[str, Any]:
        """Send event reminder email."""
        
        # Auto-detect location TBA from flag or string value
        norm_location = (event_location or '').strip().lower()
        if location_tba or norm_location in ('tbd', 'tba', 'to be announced', 'venue tba', 'venue: to be announced'):
            location_tba = True
            maps_url = None

        reminder_times = {
            "24h": "24 hours",
            "1h": "1 hour"
        }
        
        subject = f"Event Reminder - {event_title} starts in {reminder_times.get(reminder_type, 'soon')}"
        
        html_content = self._create_event_reminder_html(
            user_name=user_name,
            event_title=event_title,
            event_date=event_date,
            event_location=event_location,
            reminder_type=reminder_type,
            maps_url=maps_url,
            location_tba=location_tba,
            speakers_tba=speakers_tba
        )
        
        text_content = self._create_event_reminder_text(
            user_name=user_name,
            event_title=event_title,
            event_date=event_date,
            event_location=event_location,
            reminder_type=reminder_type,
            maps_url=maps_url,
            location_tba=location_tba,
            speakers_tba=speakers_tba
        )
        
        tags = [
            {"name": "type", "value": "event_reminder"},
            {"name": "reminder_type", "value": sanitize_tag_value(reminder_type)},
            {"name": "event", "value": sanitize_tag_value(event_title)},
            {"name": "registration_id", "value": sanitize_tag_value(registration_id)}
        ]
        
        return self.send_email(
            to=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            tags=tags
        )
    
    def send_feedback_request(
        self,
        user_email: str,
        user_name: str,
        event_title: str,
        feedback_url: str,
        registration_id: str
    ) -> Dict[str, Any]:
        """Send feedback request email."""
        
        subject = f"Share Your Feedback - {event_title}"
        
        html_content = self._create_feedback_request_html(
            user_name=user_name,
            event_title=event_title,
            feedback_url=feedback_url
        )
        
        text_content = self._create_feedback_request_text(
            user_name=user_name,
            event_title=event_title,
            feedback_url=feedback_url
        )
        
        tags = [
            {"name": "type", "value": "feedback_request"},
            {"name": "event", "value": sanitize_tag_value(event_title)},
            {"name": "registration_id", "value": sanitize_tag_value(registration_id)}
        ]
        
        return self.send_email(
            to=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            tags=tags
        )
    
    # HTML Template Methods
    def _create_registration_confirmation_html(
        self,
        user_name: str,
        event_title: str,
        event_date: str,
        event_location: str,
        registration_id: Optional[str] = None,
        qr_code_data: Optional[str] = None,
        requires_payment: bool = False,
        is_free_registration: bool = False,
        maps_url: Optional[str] = None,
        location_tba: bool = False,
        speakers_tba: bool = False
    ) -> str:
        """Create HTML content for registration confirmation email."""
        maps_button = ""
        if maps_url and not location_tba:
            maps_button = f"""<div style="margin: 16px 0 20px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;"><tr><td align="center" style="border-radius: 24px; background-color: #0b57d0;"><a href="{maps_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 24px; min-height: 48px; box-sizing: border-box; line-height: 24px;">View Location on Map</a></td></tr></table></div>"""

        display_location = event_location
        if location_tba:
            display_location = f"To Be Announced {template_loader.format_tba_badge('TBA')}"

        if is_free_registration:
            registration_status_title = "You're all set!"
            registration_status_message = (
                "Your registration is complete and no payment is required for this event."
            )
            items = [
                "Save this email for your records.",
                "Watch your inbox for event reminders and organizer updates."
            ]
            if location_tba:
                items.append("Venue location will be announced soon — watch your email for the final venue details.")
            if speakers_tba:
                items.append("Keynote & speaker lineup will be revealed soon on the event page.")
            items.append("Arrive early on event day for a smooth check-in.")
            next_steps_items = "\n".join(f"  <li>{item}</li>" for item in items) + "\n"
            closing_message = (
                "Thanks again for registering. We look forward to seeing you at the event!"
            )
        else:
            registration_status_title = "Registration received"
            registration_status_message = (
                "We received your registration and payment proof. Our team will manually verify your payment."
            )
            items = [
                "We'll review your payment proof and confirm your registration.",
                "Once verified, you'll receive a final confirmation email with your QR code and registration details."
            ]
            if location_tba:
                items.append("Venue location will be announced soon — check your inbox for location updates.")
            if speakers_tba:
                items.append("Speaker lineup will be announced soon on the event page.")
            items.append("If we need additional information, we'll contact you at this email address.")
            next_steps_items = "\n".join(f"  <li>{item}</li>" for item in items) + "\n"
            closing_message = "Please keep an eye on your inbox for updates."
        
        context = {
            'user_name': user_name,
            'event_title': event_title,
            'event_date': event_date,
            'event_location': display_location,
            'registration_id': registration_id or '',
            'qr_code_data': qr_code_data or '',
            'registration_status_title': registration_status_title,
            'registration_status_message': registration_status_message,
            'next_steps_items': next_steps_items,
            'closing_message': closing_message,
            'maps_button': maps_button
        }
        
        return template_loader.render_email_template(
            'registration_confirmation',
            context
        )
    
    def _create_payment_notification_html(
        self,
        user_name: str,
        event_title: str,
        registration_id: str,
        status: str,
        payment_instructions: Optional[str] = None,
        qr_code_data: Optional[str] = None,
        use_cid: bool = False,
        is_free_registration: bool = False
    ) -> str:
        """Create HTML content for payment notification email."""
        
        # Get status-specific styling
        colors = template_loader.get_payment_status_colors(status)
        
        if is_free_registration:
            if status == 'approved':
                intro_paragraph = (
                    f"Great news — your registration for <strong>{event_title}</strong> is confirmed."
                )
                status_message = "Registration approved!"
                contact_prompt = (
                    "If you have questions about the event or your registration, please contact us."
                )
                next_steps = (
                    "<li>Your registration is confirmed and you're all set for the event!</li>"
                )
            elif status == 'rejected':
                intro_paragraph = (
                    f"We have an update regarding your registration for <strong>{event_title}</strong>."
                )
                status_message = "Registration not approved"
                contact_prompt = (
                    "If you have questions about the event or your registration, please contact us."
                )
                next_steps = (
                    "<li>Please contact us if you have questions about this update.</li>"
                )
            else:
                intro_paragraph = (
                    f"We have an update regarding your registration for <strong>{event_title}</strong>."
                )
                status_message = "Registration pending"
                contact_prompt = (
                    "If you have questions about the event or your registration, please contact us."
                )
                next_steps = (
                    "<li>Complete any remaining steps to secure your spot at the event.</li>"
                )
        else:
            if status == 'approved':
                intro_paragraph = (
                    f"Great news — your payment has been verified and your registration for <strong>{event_title}</strong> has been approved!"
                )
            else:
                intro_paragraph = (
                    f"We have an update regarding your payment for <strong>{event_title}</strong>."
                )
            status_message = template_loader.get_payment_status_message(status)
            contact_prompt = "If you have any questions about your registration or payment, please contact us."
            next_steps = template_loader.get_payment_next_steps(status)
        
        # Handle payment instructions section
        payment_instructions_section = ""
        if payment_instructions and status == 'pending':
            payment_instructions_section = f"""
            <div style="background-color: #f8fafd; border: 1px solid #dadce0; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 8px 0; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 15px; font-weight: 600; color: #1f1f1f;">Payment Instructions</h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #5f6368;">{payment_instructions}</p>
            </div>
            """
        
        # Handle QR code section for approved payments
        qr_code_section = ""
        if qr_code_data and status == 'approved':
            # Use CID reference for attachment or base64 inline
            img_src = "cid:qr_code_cid" if use_cid else f"data:image/png;base64,{qr_code_data}"
            
            qr_code_section = f"""
            <div style="background-color: #f8fafd; border: 1px solid #dadce0; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
                <h3 style="color: #1f1f1f; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 16px; font-weight: 600; margin: 0 0 6px 0;">Your Check-In QR Code</h3>
                <p style="color: #5f6368; font-size: 14px; margin: 0 0 16px 0;">Present this QR code at the venue door for instant check-in</p>
                <img src="{img_src}" alt="Check-in QR Code" width="220" height="220" style="display: block; margin: 0 auto; max-width: 220px; width: 220px; height: auto; border: 1px solid #dadce0; border-radius: 8px; background-color: #ffffff; padding: 8px;" />
                <p style="color: #1a73e8; font-size: 13px; font-weight: 500; margin: 14px 0 0 0;">
                    Registration ID: <span style="font-family: monospace; font-size: 13px; font-weight: 600; background-color: #e8f0fe; color: #174ea6; padding: 3px 10px; border-radius: 12px;">{registration_id}</span>
                </p>
            </div>
            """
        
        context = {
            'user_name': user_name,
            'event_title': event_title,
            'registration_id': registration_id,
            'status_bg_color': colors['bg_color'],
            'status_border_color': colors['border_color'],
            'status_text_color': colors['text_color'],
            'status_message': status_message,
            'intro_paragraph': intro_paragraph,
            'contact_prompt': contact_prompt,
            'payment_instructions_section': payment_instructions_section,
            'qr_code_section': qr_code_section,
            'next_steps': next_steps,
            'is_free_registration': is_free_registration
        }
        
        return template_loader.render_email_template(
            'payment_notification',
            context
        )
    
    def _create_certificate_notification_html(
        self,
        user_name: str,
        event_title: str,
        certificate_url: str
    ) -> str:
        """Create HTML content for certificate notification email."""
        
        context = {
            'user_name': user_name,
            'event_title': event_title,
            'certificate_url': certificate_url
        }
        
        return template_loader.render_email_template(
            'certificate_notification',
            context
        )
    
    def _create_event_reminder_html(
        self,
        user_name: str,
        event_title: str,
        event_date: str,
        event_location: str,
        reminder_type: str,
        maps_url: Optional[str] = None,
        location_tba: bool = False,
        speakers_tba: bool = False
    ) -> str:
        """Create HTML content for event reminder email."""
        
        time_text = template_loader.get_reminder_time_text(reminder_type)
        
        maps_button = ""
        if maps_url and not location_tba:
            maps_button = f"""<div style="margin: 16px 0 20px 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;"><tr><td align="center" style="border-radius: 24px; background-color: #0b57d0;"><a href="{maps_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 24px; min-height: 48px; box-sizing: border-box; line-height: 24px;">View Location on Map</a></td></tr></table></div>"""

        display_location = event_location
        if location_tba:
            display_location = f"To Be Announced {template_loader.format_tba_badge('TBA')}"

        checklist = []
        if location_tba:
            checklist.append("Venue location will be announced soon — watch your inbox for arrival details")
        else:
            checklist.append("Plan your route to the venue in advance")
        checklist.append("Bring a valid ID for venue entry")
        checklist.append("Arrive 15 minutes early for check-in")
        checklist.append("Have your phone ready with your check-in QR code")
        if speakers_tba:
            checklist.append("Keynote &amp; speaker lineup will be revealed soon")
        else:
            checklist.append("Prepare any questions you might have for speakers")

        reminder_checklist_items = "\n".join(f"    <li>{item}</li>" for item in checklist)

        context = {
            'user_name': user_name,
            'event_title': event_title,
            'event_date': event_date,
            'event_location': display_location,
            'time_text': time_text,
            'maps_button': maps_button,
            'reminder_checklist_items': reminder_checklist_items
        }
        
        return template_loader.render_email_template(
            'event_reminder',
            context
        )
    
    def _create_feedback_request_html(
        self,
        user_name: str,
        event_title: str,
        feedback_url: str
    ) -> str:
        """Create HTML content for feedback request email."""
        
        context = {
            'user_name': user_name,
            'event_title': event_title,
            'feedback_url': feedback_url
        }
        
        return template_loader.render_email_template(
            'feedback_request',
            context
        )
    
    # Text Template Methods
    def _create_registration_confirmation_text(
        self,
        user_name: str,
        event_title: str,
        event_date: str,
        event_location: str,
        registration_id: Optional[str] = None,
        requires_payment: bool = False,
        is_free_registration: bool = False,
        maps_url: Optional[str] = None,
        location_tba: bool = False,
        speakers_tba: bool = False
    ) -> str:
        """Create plain text content for registration confirmation email."""
        display_location = "To Be Announced (TBA)" if location_tba else event_location
        registration_status_text = (
            "NO PAYMENT REQUIRED: Your registration is complete."
            if is_free_registration
            else "PAYMENT VERIFICATION: We received your payment proof and will verify it shortly."
        )

        steps = ["- Save this email for your records", "- Watch your inbox for event reminders and organizer updates"] if is_free_registration else [
            "- We'll review your payment proof and registration details",
            "- You'll receive a final confirmation and QR code after approval"
        ]
        if location_tba:
            steps.append("- Venue location is To Be Announced (we'll email you once confirmed)")
        if speakers_tba:
            steps.append("- Speaker lineup will be announced soon on the event page")
        if is_free_registration:
            steps.append("- Arrive 15 minutes early for check-in")
        else:
            steps.append("- If we need more details, we'll contact you by email")
        next_steps_text = "\n".join(steps)

        payment_text = (
            "\nPAYMENT REQUIRED: Please complete your payment to secure your spot. Check your email for payment instructions.\n"
            if requires_payment
            else ""
        )
        
        maps_text = f"- Location Map: {maps_url}\n" if (maps_url and not location_tba) else ""
        
        return f"""
Registration Confirmed - {event_title}

Hello {user_name}!

Thank you for registering for {event_title}. We're excited to have you join us!

EVENT DETAILS:
- Event: {event_title}
- Date: {event_date}
- Location: {display_location}
{maps_text}{f'- Registration ID: {registration_id}' if registration_id else ''}
{registration_status_text}
{payment_text}
WHAT'S NEXT:
{next_steps_text}

If you have any questions, feel free to contact us.

Googleyness,
Google Developer Groups - Davao

---
This email was sent to {user_name} for their registration to {event_title}.
© 2026 GDG Davao. All rights reserved.
        """
    
    def _create_payment_notification_text(
        self,
        user_name: str,
        event_title: str,
        registration_id: str,
        status: str,
        payment_instructions: Optional[str] = None,
        is_free_registration: bool = False
    ) -> str:
        """Create plain text content for payment notification email."""
        
        if is_free_registration:
            status_messages = {
                'approved': 'Registration approved!',
                'rejected': 'Registration not approved',
                'pending': 'Registration pending'
            }
            intro = {
                'approved': f"Great news — your registration for {event_title} is confirmed.",
                'rejected': f"We have an update regarding your registration for {event_title}.",
                'pending': f"We have an update regarding your registration for {event_title}."
            }
            message = status_messages.get(status, 'Registration update')
            intro_line = intro.get(status, f"Update regarding your registration for {event_title}.")
            next_steps = {
                'approved': "Your registration is confirmed and you're all set for the event!",
                'rejected': "Please contact us if you have questions about this update.",
                'pending': "Complete any remaining steps to secure your spot at the event."
            }
            contact_line = (
                "If you have questions about the event or your registration, please contact us."
            )
            subject_label = (
                'Registration approved' if status == 'approved' else 'Registration update'
            )
        else:
            status_messages = {
                'approved': 'Registration Approved!',
                'rejected': 'Payment Rejected',
                'pending': 'Payment Pending'
            }
            message = status_messages.get(status, 'Registration Update')
            intro_line = (
                f"Great news — your payment has been verified and your registration for {event_title} has been approved!"
                if status == 'approved'
                else f"We have an update regarding your payment for {event_title}."
            )
            next_steps = {
                'approved': "Your registration is confirmed and you're all set for the event!",
                'rejected': "Please check your payment details and try again.",
                'pending': "Complete your payment to secure your spot at the event."
            }
            contact_line = "If you have any questions about your registration or payment, please contact us."
            subject_label = "Registration approved" if status == 'approved' else "Payment update"
        
        instructions_text = f"\nPAYMENT INSTRUCTIONS:\n{payment_instructions}\n" if payment_instructions and status == 'pending' else ""
        
        return f"""
{subject_label} - {event_title}

Hello {user_name}!

{intro_line}

{message}
Registration ID: {registration_id}
{instructions_text}
NEXT STEPS:
- {next_steps.get(status, 'Please contact us for assistance.')}
- Keep this email for your records

{contact_line}

Googleyness,
Google Developer Groups - Davao

---
This email was sent to {user_name} regarding their registration for {event_title}.
© 2024 GDG Davao. All rights reserved.
        """
    
    def _create_certificate_notification_text(
        self,
        user_name: str,
        event_title: str,
        certificate_url: str
    ) -> str:
        """Create plain text content for certificate notification email."""
        
        return f"""
Certificate Ready - {event_title}

Congratulations {user_name}!

Your certificate for {event_title} is now ready for download.

DOWNLOAD YOUR CERTIFICATE:
{certificate_url}

CERTIFICATE DETAILS:
- Digital certificate with your name and event details
- Verifiable and shareable on professional networks
- Available for download anytime
- Perfect for your portfolio and LinkedIn profile

Thank you for participating in our event. We hope you had a great experience!

Googleyness,
Google Developer Groups - Davao

---
This certificate was generated for {user_name} for their participation in {event_title}.
© 2024 GDG Davao. All rights reserved.
        """
    
    def _create_event_reminder_text(
        self,
        user_name: str,
        event_title: str,
        event_date: str,
        event_location: str,
        reminder_type: str,
        maps_url: Optional[str] = None,
        location_tba: bool = False,
        speakers_tba: bool = False
    ) -> str:
        """Create plain text content for event reminder email."""
        
        reminder_times = {
            "24h": "24 hours",
            "1h": "1 hour",
            "checked_in": "now"
        }
        
        time_text = reminder_times.get(reminder_type, "soon")
        display_location = "To Be Announced (TBA)" if location_tba else event_location
        maps_text = f"- Location Map: {maps_url}\n" if (maps_url and not location_tba) else ""
        
        venue_check = "- Venue location will be announced soon (watch your inbox for updates)" if location_tba else "- Plan your route to the venue"
        speaker_check = "- Keynote & speaker lineup will be revealed soon" if speakers_tba else "- Prepare any questions you might have"
        
        return f"""
Event Reminder - {event_title}

Hello {user_name}!

{event_title} starts in {time_text}!

EVENT DETAILS:
- Event: {event_title}
- Date & Time: {event_date}
- Location: {display_location}
{maps_text}
REMINDER CHECKLIST:
{venue_check}
- Bring a valid ID for check-in
- Arrive 15 minutes early
- Bring your phone for QR code check-in
{speaker_check}

We're excited to see you there!

Googleyness,
Google Developer Groups - Davao

---
This reminder was sent to {user_name} for {event_title}.
© 2026 GDG Davao. All rights reserved.
        """
    
    def _create_feedback_request_text(
        self,
        user_name: str,
        event_title: str,
        feedback_url: str
    ) -> str:
        """Create plain text content for feedback request email."""
        
        return f"""
Share Your Feedback - {event_title}

Hello {user_name}!

Thank you for attending {event_title}! We hope you had a great time.

Your feedback is incredibly valuable to us. It helps us improve our events and create better experiences for everyone.

SHARE YOUR FEEDBACK:
{feedback_url}

WHAT WE'D LOVE TO KNOW:
- How was your overall experience?
- What did you enjoy most?
- What could we improve?
- Would you recommend our events to others?
- Any suggestions for future events?

Your feedback will help us make our next events even better!

Googleyness,
Google Developer Groups - Davao

---
This feedback request was sent to {user_name} for {event_title}.
© 2024 GDG Davao. All rights reserved.
        """


# Global email service instance
email_service = EmailService()
