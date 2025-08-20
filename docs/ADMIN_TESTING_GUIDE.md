# Testing Admin & Organizer Users - Quick Guide

## 🚀 Quick Start

### 1. Access Management Portal
Navigate to: `http://apohub.localhost:5173`

### 2. Admin Login Credentials
- **Email:** `admin@gdgdavao.org`
- **Password:** `password123`

### 3. Organizer Login Credentials
- **Email:** `organizer@gdgdavao.org`
- **Password:** `password123`

### 4. Alternative Access Methods

#### Method 1: Quick Login Helper
- On the login page, you'll see a blue box with "Quick Login (Development)"
- Click the "Login" button next to "Admin User" or "Organizer User"

#### Method 2: Dev Credentials Widget
- Look for a gray info button in the bottom-right corner of any page
- Click it to see all available test credentials
- Click "Go to Management Portal →" for direct access

#### Method 3: Manual Login
- Go to `http://apohub.localhost:5173/login`
- Enter credentials manually
- Click "Sign In"

## 🔧 What You Can Test

### Admin Features Available:
✅ Admin Dashboard (`/dashboard`)
✅ Event Management (`/events`)
✅ User Management (`/users`)
✅ Attendee Management (`/attendees`)
✅ Social Media Management (`/social`)
✅ Forms Management (`/forms`)
✅ Certificate Management (`/certificates`)
✅ Analytics (`/analytics`)
✅ Payment Verification (`/payment-verification`)

### Organizer Features Available:
✅ Organizer Dashboard (`/organizer` or `/dashboard`)
✅ Create Events (`/events/create`)
✅ Manage Events (`/events`)
✅ Event Analytics (`/events/:id/analytics`)
✅ Attendee Management (`/events/:id/attendees`)

### Subdomain Behavior:
✅ Admin and Organizer routes only work on apohub subdomain
✅ Main domain doesn't show admin/organizer navigation
✅ Sign in/up buttons only appear on apohub subdomain
✅ Clean separation between public and management interfaces
✅ All authentication happens on apohub subdomain

## 🎯 Test Different Roles

### Admin Role (apohub subdomain)
- URL: `http://apohub.localhost:5173`
- Email: `admin@gdgdavao.org`
- Password: `password123`
- Access: All admin features + all organizer features

### Organizer Role (apohub subdomain)
- URL: `http://apohub.localhost:5173`
- Email: `organizer@gdgdavao.org`
- Password: `password123`
- Access: Event creation and management features only

### Attendee (Main Domain)
- URL: `http://localhost:5173`
- Email: `attendee@example.com`
- Password: `password123`
- Access: Public event viewing and registration only

## 🐛 Troubleshooting

### If apohub.localhost doesn't work:
1. Try accessing directly: `http://apohub.localhost:5173`
2. Check if your dev server is running on port 5173
3. Add to `/etc/hosts` if needed:
   ```
   127.0.0.1 apohub.localhost
   ```
4. Clear browser cache and try again

### Debug Information:
- Open browser dev tools → Console
- Look for "Subdomain Debug:" logs
- Verify subdomain detection is working correctly

## 📱 Mobile Testing

The subdomain approach works on mobile browsers too:
- Use your computer's IP address
- Example: `http://apohub.192.168.1.100:5173`
- Make sure to use the apohub subdomain format

---

**Note:** All these features are development-only and won't appear in production builds.
