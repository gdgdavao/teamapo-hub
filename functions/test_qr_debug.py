#!/usr/bin/env python3
"""
Debug script to test QR code generation and HTML output
"""

import os
import sys

def test_qr_generation():
    """Test QR code generation and output HTML"""
    try:
        import qrcode
        from io import BytesIO
        import base64
        from PIL import Image
        
        print("=" * 60)
        print("QR Code Generation Test")
        print("=" * 60)
        
        # Create QR code with optimized settings
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=6,
            border=2
        )
        qr.add_data("registration:TEST123456")
        qr.make(fit=True)
        
        # Generate image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save with optimization
        buffer = BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        buffer.seek(0)
        qr_code_data = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"✅ QR code generated successfully")
        print(f"   Base64 length: {len(qr_code_data)} characters")
        print(f"   Estimated size: {len(qr_code_data) * 3 / 4 / 1024:.2f} KB")
        print(f"   First 100 chars: {qr_code_data[:100]}...")
        
        # Generate sample HTML
        html = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code Test</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h1>QR Code Email Test</h1>
    
    <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <h3 style="color: #0369a1; margin-top: 0;">Your Check-In QR Code</h3>
        <p style="color: #0c4a6e; margin-bottom: 15px;">Present this QR code at the event for check-in</p>
        <img src="data:image/png;base64,{qr_code_data}" alt="Check-in QR Code" style="display: block; margin: 0 auto; max-width: 250px; width: 250px; height: auto; border: 2px solid #0369a1; border-radius: 8px;" />
        <p style="color: #0c4a6e; font-size: 12px; margin-top: 10px;">Registration ID: TEST123456</p>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
        <h4>Technical Details:</h4>
        <ul>
            <li>Base64 length: {len(qr_code_data)} characters</li>
            <li>Estimated size: {len(qr_code_data) * 3 / 4 / 1024:.2f} KB</li>
            <li>Box size: 6</li>
            <li>Border: 2</li>
            <li>Format: PNG (optimized)</li>
        </ul>
    </div>
</body>
</html>
'''
        
        # Save to file
        output_file = "qr_test_output.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"\n✅ HTML test file created: {output_file}")
        print(f"   Open this file in a browser to test QR code rendering")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_qr_generation()
    sys.exit(0 if success else 1)
