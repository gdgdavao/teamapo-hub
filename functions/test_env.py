#!/usr/bin/env python3
"""
Test script to check if environment variables are loaded correctly.
"""

import os
import sys
from pathlib import Path

def load_env_file():
    """Load environment variables from .env file in functions directory."""
    env_file = Path(__file__).parent / '.env'
    print(f"Looking for .env file at: {env_file.absolute()}")
    
    if env_file.exists():
        print("✅ .env file found!")
        with open(env_file, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    os.environ[key] = value
                    # Don't print the actual API key for security
                    if 'API_KEY' in key:
                        print(f"  Line {line_num}: {key}={value[:10]}...")
                    else:
                        print(f"  Line {line_num}: {key}={value}")
                elif line and not line.startswith('#'):
                    print(f"  Line {line_num}: (ignored) {line}")
    else:
        print("❌ .env file not found!")
        print("Please create a .env file in the functions directory with:")
        print("RESEND_API_KEY=re_your_actual_api_key_here")
        print("FROM_EMAIL=noreply@gdgdavao.com")
        return False
    
    return True

def test_environment():
    """Test if environment variables are accessible."""
    print("\n" + "="*50)
    print("Environment Variable Test")
    print("="*50)
    
    # Load from .env file
    load_env_file()
    
    print("\n📋 Checking environment variables:")
    
    # Test RESEND_API_KEY
    api_key = os.getenv('RESEND_API_KEY')
    if api_key:
        if api_key.startswith('re_'):
            print(f"✅ RESEND_API_KEY: {api_key[:10]}... (valid format)")
        else:
            print(f"⚠️  RESEND_API_KEY: {api_key} (invalid format - should start with 're_')")
    else:
        print("❌ RESEND_API_KEY: Not found")
    
    # Test FROM_EMAIL
    from_email = os.getenv('FROM_EMAIL')
    if from_email:
        print(f"✅ FROM_EMAIL: {from_email}")
    else:
        print("❌ FROM_EMAIL: Not found (will use default: noreply@gdgdavao.com)")
    
    print("\n🧪 Testing email service initialization...")
    
    try:
        from email_service import EmailService
        email_service = EmailService()
        print("✅ EmailService initialized successfully!")
        
        # Test if we can access the Resend API
        if email_service.api_key and email_service.api_key.startswith('re_'):
            print("✅ Resend API key is properly configured")
        else:
            print("❌ Resend API key is missing or invalid")
            
    except Exception as e:
        print(f"❌ Failed to initialize EmailService: {str(e)}")
        return False
    
    return True

def main():
    """Run environment tests."""
    print("🔧 ApoHub Email Service Environment Test")
    print("="*50)
    
    # Show current working directory
    print(f"Current directory: {os.getcwd()}")
    print(f"Script location: {Path(__file__).parent.absolute()}")
    
    success = test_environment()
    
    if success:
        print("\n🎉 All tests passed! Email service should work correctly.")
        print("\n💡 Next steps:")
        print("1. Make sure your .env file has the correct Resend API key")
        print("2. Restart your Firebase emulator")
        print("3. Test sending emails using the functions")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        print("\n🔧 Troubleshooting:")
        print("1. Create a .env file in the functions directory")
        print("2. Add your Resend API key: RESEND_API_KEY=re_your_key_here")
        print("3. Add your from email: FROM_EMAIL=noreply@yourdomain.com")
        print("4. Make sure the API key starts with 're_'")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
