#!/usr/bin/env python3
"""
Test script for Resend email functionality.
Run this script to test different email types.
"""

import os
import sys
from email_service import email_service

TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL", "test@example.com")

def test_registration_confirmation():
    """Test registration confirmation email."""
    print("Testing registration confirmation email...")
    
    result = email_service.send_registration_confirmation(
        user_email=TEST_USER_EMAIL,
        user_name="John Doe",
        event_title="GDG Davao Meetup 2024",
        event_date="January 15, 2024 at 10:00 AM",
        event_location="Davao City Convention Center",
        registration_id="REG123456",
        qr_code_data=None,  # Would be base64 encoded QR code in real usage
        requires_payment=True
    )
    
    print(f"Result: {result}")
    return result['success']

def test_payment_notification():
    """Test payment notification email."""
    print("Testing payment notification email...")
    
    # Generate test QR code for approved payment
    qr_code_data = None
    try:
        import qrcode
        from io import BytesIO
        import base64
        from PIL import Image
        
        # Create QR code with optimized settings for email
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=6,  # Reduced for smaller file size and better email compatibility
            border=2     # Reduced for smaller file size
        )
        qr.add_data("registration:REG123456")
        qr.make(fit=True)
        
        # Generate image with optimization
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to RGB if needed and optimize
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save with optimization for email clients
        buffer = BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        qr_code_data = base64.b64encode(buffer.getvalue()).decode()
        print(f"✅ QR code generated successfully. Size: {len(qr_code_data)} bytes")
    except Exception as qr_err:
        print(f"⚠️  Failed to generate QR code: {str(qr_err)}")
    
    result = email_service.send_payment_notification(
        user_email=TEST_USER_EMAIL,
        user_name="John Doe",
        event_title="GDG Davao Meetup 2024",
        registration_id="REG123456",
        status="approved",
        payment_instructions=None,
        qr_code_data=qr_code_data
    )
    
    print(f"Result: {result}")
    return result['success']

def test_certificate_notification():
    """Test certificate notification email."""
    print("Testing certificate notification email...")
    
    result = email_service.send_certificate_notification(
        user_email=TEST_USER_EMAIL,
        user_name="John Doe",
        event_title="GDG Davao Meetup 2024",
        certificate_url="https://example.com/certificate/123",
        registration_id="REG123456"
    )
    
    print(f"Result: {result}")
    return result['success']

def test_event_reminder():
    """Test event reminder email."""
    print("Testing event reminder email...")
    
    result = email_service.send_event_reminder(
        user_email=TEST_USER_EMAIL,
        user_name="John Doe",
        event_title="GDG Davao Meetup 2024",
        event_date="January 15, 2024 at 10:00 AM",
        event_location="Davao City Convention Center",
        registration_id="REG123456",
        reminder_type="24h"
    )
    
    print(f"Result: {result}")
    return result['success']

def test_feedback_request():
    """Test feedback request email."""
    print("Testing feedback request email...")
    
    result = email_service.send_feedback_request(
        user_email=TEST_USER_EMAIL,
        user_name="John Doe",
        event_title="GDG Davao Meetup 2024",
        feedback_url="https://example.com/feedback/123",
        registration_id="REG123456"
    )
    
    print(f"Result: {result}")
    return result['success']

def test_checkin_notification():
    """Test check-in notification email."""
    print("Testing check-in notification email...")
    
    result = email_service.send_event_reminder(
        user_email=TEST_USER_EMAIL,
        user_name="John Doe",
        event_title="GDG Davao Meetup 2024",
        event_date="January 15, 2024 at 10:00 AM",
        event_location="Davao City Convention Center",
        registration_id="REG123456",
        reminder_type="checked_in"
    )
    
    print(f"Result: {result}")
    return result['success']

def main():
    """Run all email tests."""
    print("=" * 50)
    print("Resend Email Service Test")
    print("=" * 50)
    
    # Check if API key is set
    if not os.getenv('RESEND_API_KEY'):
        print("ERROR: RESEND_API_KEY environment variable not set!")
        print("Please set your Resend API key:")
        print("export RESEND_API_KEY=re_your_api_key_here")
        sys.exit(1)
    
    if not os.getenv('FROM_EMAIL'):
        print("WARNING: FROM_EMAIL environment variable not set!")
        print("Using default: apohub@gdgdavao.org")
    
    print(f"Using API Key: {os.getenv('RESEND_API_KEY')[:10]}...")
    print(f"From Email: {os.getenv('FROM_EMAIL', 'apohub@gdgdavao.org')}")
    print()
    
    tests = [
        ("Registration Confirmation", test_registration_confirmation),
        ("Payment Notification", test_payment_notification),
        ("Certificate Notification", test_certificate_notification),
        ("Event Reminder", test_event_reminder),
        ("Feedback Request", test_feedback_request),
        ("Check-in Notification", test_checkin_notification),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'-' * 30}")
        print(f"Running: {test_name}")
        print(f"{'-' * 30}")
        
        try:
            success = test_func()
            results.append((test_name, success))
            print(f"✅ {test_name}: {'PASSED' if success else 'FAILED'}")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'=' * 50}")
    print("Test Summary")
    print(f"{'=' * 50}")
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Email service is working correctly.")
        sys.exit(0)
    else:
        print("⚠️  Some tests failed. Check the error messages above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
