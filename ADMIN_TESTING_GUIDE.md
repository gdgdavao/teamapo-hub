# Testing Admin User - Quick Guide

## 🚀 Quick Start

### 1. Access Admin Portal
Navigate to: `http://admin.localhost:5173`

### 2. Admin Login Credentials
- **Email:** `admin@gdgdavao.org`
- **Password:** `password123`

### 3. Alternative Access Methods

#### Method 1: Quick Login Helper
- On the login page, you'll see a blue box with "Quick Login (Development)"
- Click the "Login" button next to "Admin User"

#### Method 2: Dev Credentials Widget
- Look for a gray info button in the bottom-right corner of any page
- Click it to see all available test credentials
- Click "Go to Admin Portal →" for direct access

#### Method 3: Manual Login
- Go to `http://admin.localhost:5173/login`
- Enter credentials manually
- Click "Sign In"

## 🔧 What You Can Test

### Admin Features Available:
✅ Admin Dashboard (`/admin`)
✅ Event Management (`/admin/events`)
✅ User Management (`/admin/attendees`)
✅ Social Media Management (`/admin/social`)
✅ Forms Management (`/admin/forms`)
✅ Certificate Management (`/admin/certificates`)
✅ Analytics (`/admin/analytics`)

### Subdomain Behavior:
✅ Admin routes only work on admin subdomain
✅ Main domain doesn't show admin navigation
✅ Sign in/up buttons only appear on admin subdomain
✅ Clean separation between public and admin interfaces

## 🎯 Test Other Roles

### Organizer (Main Domain)
- URL: `http://localhost:5173`
- Email: `organizer@gdgdavao.org`
- Password: `password123`
- Can access organizer features but NOT admin panel

### Attendee (Main Domain)
- URL: `http://localhost:5173`
- Email: `attendee@example.com`
- Password: `password123`
- Standard user access only

## 🐛 Troubleshooting

### If admin.localhost doesn't work:
1. Try accessing directly: `http://admin.localhost:5173`
2. Check if your dev server is running on port 5173
3. Add to `/etc/hosts` if needed:
   ```
   127.0.0.1 admin.localhost
   ```
4. Clear browser cache and try again

### Debug Information:
- Open browser dev tools → Console
- Look for "Subdomain Debug:" logs
- Verify subdomain detection is working correctly

## 📱 Mobile Testing

The subdomain approach works on mobile browsers too:
- Use your computer's IP address
- Example: `http://admin.192.168.1.100:5173`
- Make sure to use the admin subdomain format

---

**Note:** All these features are development-only and won't appear in production builds.
