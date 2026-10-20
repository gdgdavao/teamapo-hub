"""
Email template loader utility for rendering HTML email templates.
Handles loading template files and replacing placeholders with actual data.
"""

import os
import re
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class EmailTemplateLoader:
    """Utility class for loading and rendering email templates."""
    
    def __init__(self):
        """Initialize the template loader with the templates directory path."""
        self.templates_dir = Path(__file__).parent / 'email_templates'
        if not self.templates_dir.exists():
            logger.warning(f"Email templates directory not found: {self.templates_dir}")
    
    def load_template(self, template_name: str) -> str:
        """
        Load a template file and return its content.
        
        Args:
            template_name: Name of the template file (without .html extension)
            
        Returns:
            Template content as string
        """
        template_path = self.templates_dir / f"{template_name}.html"
        
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            logger.error(f"Template file not found: {template_path}")
            return ""
        except Exception as e:
            logger.error(f"Error loading template {template_name}: {str(e)}")
            return ""
    
    def render_template(self, template_content: str, context: Dict[str, Any]) -> str:
        """
        Render a template by replacing placeholders with context values.
        
        Args:
            template_content: Template content with {{placeholder}} syntax
            context: Dictionary of values to replace placeholders
            
        Returns:
            Rendered template content
        """
        rendered_content = template_content
        
        # Replace all {{key}} placeholders with context values
        for key, value in context.items():
            placeholder = f"{{{{{key}}}}}"
            rendered_content = rendered_content.replace(placeholder, str(value))
        
        return rendered_content
    
    def render_email_template(
        self,
        template_name: str,
        context: Dict[str, Any],
        footer_message: Optional[str] = None,
        use_embedded_logo: bool = False
    ) -> str:
        """
        Render a complete email using base template and content template.
        
        Args:
            template_name: Name of the content template
            context: Context data for template rendering
            footer_message: Optional custom footer message
            
        Returns:
            Complete rendered HTML email
        """
        # Load base template (with option for embedded logo version)
        base_template_name = 'base_template_with_embedded_logo' if use_embedded_logo else 'base_template'
        base_template = self.load_template(base_template_name)
        if not base_template:
            logger.error(f"{base_template_name} not found, trying fallback")
            # Try the other template as fallback
            fallback_name = 'base_template' if use_embedded_logo else 'base_template_with_embedded_logo'
            base_template = self.load_template(fallback_name)
            if not base_template:
                logger.error("No base template found, falling back to content only")
                content_template = self.load_template(template_name)
                return self.render_template(content_template, context)
        
        # Load content template
        content_template = self.load_template(template_name)
        if not content_template:
            logger.error(f"Content template '{template_name}' not found")
            return ""
        
        # Load and render footer with custom message
        footer_content = ""
        footer_template = self.load_template('footer')
        if footer_template:
            footer_context = {
                **context,
                'footer_message': footer_message or self.get_default_footer_message(template_name, context)
            }
            footer_content = self.render_template(footer_template, footer_context)
        
        # Render content template
        rendered_content = self.render_template(content_template, context)
        
        # Prepare context for base template
        base_context = {
            **context,
            'content': rendered_content,
            'footer_content': footer_content
        }
        
        # Render complete email
        complete_email = self.render_template(base_template, base_context)
        
        return complete_email
    
    def get_payment_status_colors(self, status: str) -> Dict[str, str]:
        """
        Get status-specific colors for payment notifications.
        
        Args:
            status: Payment status ('approved', 'rejected', 'pending')
            
        Returns:
            Dictionary with color values
        """
        status_colors = {
            'approved': {
                'bg_color': '#e6f4ea',
                'border_color': '#ceead6',
                'text_color': '#137333'
            },
            'rejected': {
                'bg_color': '#fce8e6',
                'border_color': '#fad2cf',
                'text_color': '#c5221f'
            },
            'pending': {
                'bg_color': '#fef7e0',
                'border_color': '#feefc3',
                'text_color': '#b06000'
            }
        }
        
        return status_colors.get(status, status_colors['pending'])
    
    def get_payment_status_message(self, status: str) -> str:
        """
        Get status-specific message for payment notifications.
        
        Args:
            status: Payment status
            
        Returns:
            Status message
        """
        status_messages = {
            'approved': 'Registration Approved!',
            'rejected': 'Payment Rejected',
            'pending': 'Payment Pending'
        }
        
        return status_messages.get(status, 'Payment Update')
    
    def get_payment_next_steps(self, status: str) -> str:
        """
        Get next steps HTML for payment notifications.
        
        Args:
            status: Payment status
            
        Returns:
            Next steps HTML content
        """
        next_steps = {
            'approved': "<li>Your registration is confirmed and you're all set for the event!</li>",
            'rejected': "<li>Please check your payment details and try again.</li>",
            'pending': "<li>Complete your payment to secure your spot at the event.</li>"
        }
        
        return next_steps.get(status, "<li>Please contact us for assistance.</li>")
    
    def get_reminder_time_text(self, reminder_type: str) -> str:
        """
        Get time text for event reminders.
        
        Args:
            reminder_type: Type of reminder ('24h', '1h', etc.)
            
        Returns:
            Human-readable time text
        """
        reminder_times = {
            "24h": "24 hours",
            "1h": "1 hour",
            "checked_in": "now"
        }
        
        return reminder_times.get(reminder_type, "soon")
    
    def format_tba_badge(self, text: str = "TBA") -> str:
        """
        Get HTML for Google Material 3 TBA status badge.
        
        Args:
            text: Badge label (defaults to "TBA")
            
        Returns:
            Inline HTML span with Google Material 3 neutral container styling
        """
        return f'<span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600; background-color: #e8eaed; color: #3c4043; border-radius: 4px; vertical-align: middle; margin-left: 6px; letter-spacing: 0.5px;">{text}</span>'
    
    def get_default_footer_message(self, template_name: str, context: Dict[str, Any]) -> str:
        """
        Get default footer message based on template type.
        
        Args:
            template_name: Name of the email template
            context: Template context data
            
        Returns:
            Appropriate footer message for the template type
        """
        user_name = context.get('user_name', '')
        event_title = context.get('event_title', '')
        
        if template_name == 'payment_notification' and context.get('is_free_registration'):
            return "For questions about your registration or this event, please contact us."
        
        footer_messages = {
            'registration_confirmation': f"If you don't hear from us within 2 business days, please contact us.",
            'payment_notification': f"For payment inquiries regarding your registration, please contact us.",
            'certificate_notification': f"This certificate was generated for {user_name} for their participation in {event_title}.",
            'event_reminder': f"This reminder was sent for {event_title}.",
            'feedback_request': f"This feedback request was sent for {event_title}. Your input helps us improve future events."
        }
        
        return footer_messages.get(template_name, "Thank you for using our service.")


# Global template loader instance
template_loader = EmailTemplateLoader()
