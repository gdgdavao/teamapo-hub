# Sample Users for Development

This document contains the sample users available for testing during development.

## Available Users

### Admin User
- **Email:** `admin@gdgdavao.org`
- **Password:** `password123`
- **Role:** Admin
- **Access:** Full admin panel access via `admin.localhost:5173`
- **Description:** Can access all administrative features including user management, event management, analytics, and system settings.

### Organizer User
- **Email:** `organizer@gdgdavao.org`
- **Password:** `password123`
- **Role:** Organizer
- **Access:** Organizer features on main domain
- **Description:** Can create and manage events, view attendee lists, and access event analytics.

### Attendee User
- **Email:** `attendee@example.com`
- **Password:** `password123`
- **Role:** Attendee
- **Access:** Standard user features
- **Description:** Can register for events, view certificates, and manage their profile.

## Quick Login

### Development Features
- **Login Helper:** Available on login pages in development mode
- **Dev Credentials Widget:** Floating widget in bottom-right corner (development only)
- **Console Logging:** Subdomain detection debug info in browser console

### Testing Admin Features
1. Navigate to `http://admin.localhost:5173`
2. Use admin credentials: `admin@gdgdavao.org` / `password123`
3. Access admin dashboard and all administrative features

### Testing Organizer Features
1. Navigate to `http://localhost:5173`
2. Use organizer credentials to sign in
3. Access organizer dashboard and event management features

### Testing Attendee Features
1. Navigate to `http://localhost:5173`
2. Use attendee credentials to sign in
3. Browse events and manage user profile

## Role-Based Access

- **Admin:** Only accessible via admin subdomain (`admin.localhost:5173`)
- **Organizer:** Accessible on main domain with additional organizer features
- **Attendee:** Standard user access on main domain

## Development Notes

- All passwords are `password123` for simplicity
- Users are stored in mock authentication system
- New signups with `@gdgdavao.org` emails automatically get organizer/admin roles
- Admin accounts with `admin` in the email get admin role
- The system automatically determines roles based on email patterns

## Production Considerations

- These sample users are only available in development mode
- In production, users will be created through Firebase authentication
- Role assignment in production should be done through admin panel or database
- Sample credentials are automatically hidden in production builds
