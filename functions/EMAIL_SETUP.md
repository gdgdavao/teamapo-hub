# Email Setup with Resend

This document explains how to set up and use the Resend email service for the ApoHub application.

## Prerequisites

1. A Resend account (sign up at [resend.com](https://resend.com))
2. A verified domain for sending emails
3. Resend API key

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address
3. Complete the account setup

### 2. Add and Verify Your Domain

1. In the Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `gdgdavao.com`)
4. Follow the DNS verification steps
5. Wait for domain verification (usually takes a few minutes)

### 3. Get Your API Key

1. In the Resend dashboard, go to "API Keys"
2. Click "Create API Key"
3. Give it a name (e.g., "ApoHub Production")
4. Copy the API key (starts with `re_`)

### 4. Configure Environment Variables

Add the following to your environment variables:

```bash
# Resend Email Configuration
RESEND_API_KEY=re_your_actual_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

**Important:** Replace `yourdomain.com` with your verified domain.

### 5. Install Dependencies

The Resend package is already included in `requirements.txt`. To install:

```bash
cd functions
pip install -r requirements.txt
```

## Email Types Supported

The system supports the following email types:

### 1. Registration Confirmation
- Sent when a user registers for an event
- Includes event details, QR code for check-in
- Shows payment status if required

### 2. Payment Notifications
- Sent when payment status changes (approved/rejected/pending)
- Includes payment instructions for pending payments
- Confirms registration status

### 3. Certificate Notifications
- Sent when a certificate is ready for download
- Includes download link
- Professional certificate format

### 4. Event Reminders
- 24-hour and 1-hour reminders before events
- Includes event details and preparation checklist
- Helps reduce no-shows

### 5. Feedback Requests
- Sent after events to collect attendee feedback
- Includes feedback form link
- Helps improve future events

## Firebase Functions

The following Firebase Functions are available for sending emails:

### `sendConfirmationEmail`
Sends registration confirmation email.

**Parameters:**
- `registrationId` (string): Registration ID
- `eventId` (string): Event ID
- `userEmail` (string): User's email address
- `userName` (string): User's name
- `requiresPayment` (boolean): Whether payment is required

### `sendPaymentNotification`
Sends payment status notification.

**Parameters:**
- `registrationId` (string): Registration ID
- `status` (string): Payment status ('approved', 'rejected', 'pending')
- `eventTitle` (string): Event title
- `attendeeEmail` (string): Attendee's email
- `attendeeName` (string): Attendee's name
- `paymentInstructions` (string, optional): Payment instructions

### `sendCertificateNotification`
Sends certificate ready notification.

**Parameters:**
- `userEmail` (string): User's email address
- `userName` (string): User's name
- `eventTitle` (string): Event title
- `certificateUrl` (string): Certificate download URL
- `registrationId` (string, optional): Registration ID

### `sendEventReminder`
Sends event reminder email.

**Parameters:**
- `userEmail` (string): User's email address
- `userName` (string): User's name
- `eventTitle` (string): Event title
- `eventDate` (string): Event date and time
- `eventLocation` (string): Event location
- `registrationId` (string, optional): Registration ID
- `reminderType` (string): '24h' or '1h'

### `sendFeedbackRequest`
Sends feedback request email.

**Parameters:**
- `userEmail` (string): User's email address
- `userName` (string): User's name
- `eventTitle` (string): Event title
- `feedbackUrl` (string): Feedback form URL
- `registrationId` (string, optional): Registration ID

## Usage Examples

### From Frontend (TypeScript)

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from './config/firebase';

// Send registration confirmation
const sendConfirmationEmail = httpsCallable(functions, 'sendConfirmationEmail');
await sendConfirmationEmail({
  registrationId: 'reg_123',
  eventId: 'event_456',
  userEmail: 'user@example.com',
  userName: 'John Doe',
  requiresPayment: true
});

// Send payment notification
const sendPaymentNotification = httpsCallable(functions, 'sendPaymentNotification');
await sendPaymentNotification({
  registrationId: 'reg_123',
  status: 'approved',
  eventTitle: 'GDG Davao Meetup',
  attendeeEmail: 'user@example.com',
  attendeeName: 'John Doe'
});
```

### From Backend (Python)

```python
from email_service import email_service

# Send registration confirmation
result = email_service.send_registration_confirmation(
    user_email='user@example.com',
    user_name='John Doe',
    event_title='GDG Davao Meetup',
    event_date='2024-01-15 10:00 AM',
    event_location='Davao City',
    registration_id='reg_123',
    requires_payment=True
)

if result['success']:
    print(f"Email sent successfully: {result['email_id']}")
else:
    print(f"Failed to send email: {result['message']}")
```

## Email Templates

All email templates are built with:
- **Responsive design** that works on all devices
- **Professional styling** with GDG Davao branding
- **Clear call-to-action buttons**
- **Accessibility features** for screen readers
- **Plain text fallbacks** for email clients that don't support HTML

## Monitoring and Logging

All email activities are logged in the `activity_logs` collection in Firestore with the following information:
- Email type and recipient
- Success/failure status
- Resend email ID (for tracking)
- Timestamp
- Related registration/event IDs

## Troubleshooting

### Common Issues

1. **"Invalid API key" error**
   - Verify your API key is correct
   - Ensure the key starts with `re_`
   - Check that the key is active in your Resend dashboard

2. **"Domain not verified" error**
   - Complete domain verification in Resend dashboard
   - Check DNS records are properly configured
   - Wait for DNS propagation (can take up to 24 hours)

3. **Emails not being received**
   - Check spam/junk folders
   - Verify the recipient email address is correct
   - Check Resend dashboard for delivery status
   - Review activity logs in Firestore

4. **Template rendering issues**
   - Ensure all required parameters are provided
   - Check for special characters in event titles/names
   - Verify HTML content is properly escaped

### Testing

To test email functionality:

1. Use the Firebase emulator for development
2. Check the activity logs in Firestore
3. Use Resend's test mode for development
4. Send test emails to your own address first

## Security Considerations

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables for all sensitive data
   - Rotate API keys regularly

2. **Email Content**
   - Sanitize all user input before including in emails
   - Avoid including sensitive information in email content
   - Use HTTPS for all links in emails

3. **Rate Limiting**
   - Resend has built-in rate limiting
   - Monitor usage in the Resend dashboard
   - Implement queuing for high-volume sends

## Cost Considerations

Resend pricing (as of 2024):
- **Free tier**: 3,000 emails/month
- **Pro tier**: $20/month for 50,000 emails
- **Enterprise**: Custom pricing for high volume

Monitor your usage in the Resend dashboard to avoid unexpected charges.

## Support

For issues with:
- **Resend service**: Contact Resend support
- **Email templates**: Check the email service code
- **Firebase functions**: Review function logs
- **Integration issues**: Check this documentation and code examples

