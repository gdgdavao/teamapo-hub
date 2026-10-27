#!/usr/bin/env python3
"""
Test script for email templates & sending functionality.
Supports sending via local Mailpit (USE_MAILPIT=true) or Resend API.
"""

import os
import sys
from email_service import email_service

# Target test email
TEST_USER_EMAIL = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else os.getenv("TEST_USER_EMAIL", "mail@gdgdavao.org")

def test_registration_confirmation():
    """Test registration confirmation email."""
    print(f"Testing registration confirmation email to {TEST_USER_EMAIL}...")
    
    result = email_service.send_registration_confirmation(
        user_email=TEST_USER_EMAIL,
        user_name="Juan Dela Cruz",
        event_title="GDG Davao Tech Summit 2026",
        event_date="November 14, 2026 at 9:00 AM",
        event_location="SMX Convention Center, Davao City",
        registration_id="REG-DVO-2026-001",
        qr_code_data=None,
        requires_payment=False,
        is_free_registration=True
    )
    
    print(f"Result: {result}")
    return result['success']

def test_payment_notification_approved():
    """Test registration approval notification email (approved ticket pass)."""
    print(f"Testing registration approval notification (approved ticket pass) to {TEST_USER_EMAIL}...")
    
    result = email_service.send_payment_notification(
        user_email=TEST_USER_EMAIL,
        user_name="Juan Dela Cruz",
        event_title="GDG Davao Tech Summit 2026",
        registration_id="REG-DVO-2026-001",
        status="approved",
        payment_instructions=None,
        is_free_registration=False,
        wallet_pass_token="test_wallet_pass_token_xyz"
    )
    
    print(f"Result: {result}")
    return result['success']

def test_certificate_notification():
    """Test certificate notification email."""
    print(f"Testing certificate notification email to {TEST_USER_EMAIL}...")
    
    result = email_service.send_certificate_notification(
        user_email=TEST_USER_EMAIL,
        user_name="Juan Dela Cruz",
        event_title="GDG Davao Tech Summit 2026",
        certificate_url="https://apohub.gdgdavao.org/verify/CERT-2026-DVO",
        registration_id="REG-DVO-2026-001"
    )
    
    print(f"Result: {result}")
    return result['success']

def test_event_reminder():
    """Test event reminder email."""
    print(f"Testing event reminder email to {TEST_USER_EMAIL}...")
    
    result = email_service.send_event_reminder(
        user_email=TEST_USER_EMAIL,
        user_name="Juan Dela Cruz",
        event_title="GDG Davao Tech Summit 2026",
        event_date="November 14, 2026 at 9:00 AM",
        event_location="SMX Convention Center, Davao City",
        registration_id="REG-DVO-2026-001",
        reminder_type="24h"
    )
    
    print(f"Result: {result}")
    return result['success']

def test_feedback_request():
    """Test feedback request email."""
    print(f"Testing feedback request email to {TEST_USER_EMAIL}...")
    
    result = email_service.send_feedback_request(
        user_email=TEST_USER_EMAIL,
        user_name="Juan Dela Cruz",
        event_title="GDG Davao Tech Summit 2026",
        feedback_url="https://apohub.gdgdavao.org/feedback/evt-dvo-2026",
        registration_id="REG-DVO-2026-001"
    )
    
    print(f"Result: {result}")
    return result['success']

def main():
    """Run all email tests."""
    print("=" * 60)
    print("TeamApo Hub Email Dispatch Test")
    print("=" * 60)
    
    if email_service.use_mailpit:
        print(f"Mode: MAILPIT DEV MODE (SMTP {email_service.mailpit_host}:{email_service.mailpit_port})")
        print(f"Web UI: http://localhost:8025")
    else:
        print("Mode: RESEND PRODUCTION API")
        api_key = os.getenv('RESEND_API_KEY')
        if not api_key:
            print("ERROR: RESEND_API_KEY environment variable not set for production mode!")
            sys.exit(1)
        print(f"API Key: {api_key[:10]}...")
    
    print(f"Sender: {email_service.from_address}")
    print(f"Recipient: {TEST_USER_EMAIL}")
    print("=" * 60)
    
    tests = [
        ("Registration Confirmation", test_registration_confirmation),
        ("Registration Approved (Ticket Pass)", test_payment_notification_approved),
        ("Certificate Ready", test_certificate_notification),
        ("Event Reminder (24h)", test_event_reminder),
        ("Feedback Request", test_feedback_request),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'-' * 40}")
        print(f"Running: {test_name}")
        print(f"{'-' * 40}")
        
        try:
            success = test_func()
            results.append((test_name, success))
            print(f"✅ {test_name}: {'PASSED' if success else 'FAILED'}")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'=' * 60}")
    print("Test Summary")
    print(f"{'=' * 60}")
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name:36} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All emails sent successfully!")
        if email_service.use_mailpit:
            print("👉 Open http://localhost:8025 in your browser to inspect the emails in Mailpit.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the error messages above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
