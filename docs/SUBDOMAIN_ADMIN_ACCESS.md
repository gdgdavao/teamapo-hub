# APOHUB - Subdomain-Based Admin Access

## Overview

APOHUB now implements subdomain-based admin access to provide better security and separation of concerns between public features and administrative functions.

## How It Works

### Main Domain (`domain.com` or `www.domain.com`)
- Public event browsing and registration
- User dashboards and certificates
- Organizer features (for users with organizer role)
- **No Sign In/Sign Up buttons** - these are hidden from public users
- **No direct admin access** - admin routes are not available

### Admin Subdomain (`admin.domain.com`)
- Administrative login page with Sign In/Sign Up buttons
- Full admin dashboard and management features
- Admin-only routes and navigation
- Restricted access to admin role users only

## Development Setup

### Local Development

For local development, the subdomain detection works with:
- `localhost:5173` - Main domain
- `admin.localhost:5173` - Admin subdomain

To test admin subdomain locally, you have two options:

**Option 1: Using admin.localhost (Recommended)**
1. Simply navigate to `http://admin.localhost:5173` in your browser
2. Most modern browsers will resolve this automatically

**Option 2: Using /etc/hosts (if Option 1 doesn't work)**
1. Add entries to your `/etc/hosts` file:

   ```bash
   127.0.0.1 admin.localhost
   ```

2. Access the app via `http://admin.localhost:5173`

### Production Setup
For production deployment, ensure your DNS is configured with:
- `yourdomain.com` - Main application
- `admin.yourdomain.com` - Admin portal

Both should point to the same server/application, as the routing is handled client-side based on the subdomain.

## Security Benefits

1. **Separation of Concerns**: Public users can't accidentally access admin features
2. **Cleaner UX**: Main domain focuses purely on events and user experience
3. **Access Control**: Admin features are only visible on the admin subdomain
4. **Reduced Attack Surface**: Admin login is not exposed on the main domain

## User Experience

### Public Users
- Visit main domain to browse events
- Clean, focused interface without admin clutter
- Register and manage their event participation

### Administrators
- Visit `admin.yourdomain.com` to access admin features
- Clear separation from public features
- Dedicated admin interface and navigation

## Implementation Details

### Key Files Modified
- `src/utils/subdomain.ts` - Subdomain detection utilities
- `src/App.tsx` - Routing logic based on subdomain
- `src/components/Layout/Header.tsx` - Conditional navigation
- `src/pages/public/LandingPage.tsx` - Removed auth buttons, added admin portal link

### Subdomain Detection
The `subdomain.ts` utility provides:
- `getSubdomain()` - Extracts subdomain from current URL
- `isAdminSubdomain()` - Checks if current subdomain is 'admin'
- `isMainDomain()` - Checks if on main domain (no subdomain or www)
- `getAdminUrl(path)` - Generates admin subdomain URLs
- `getMainUrl(path)` - Generates main domain URLs

### Route Protection
- `AdminRoute` component ensures admin routes only work on admin subdomain
- `ProtectedRoute` component handles general authentication
- `PublicRoute` component handles guest-only pages

## Migration Notes

### For Existing Users
- Existing admin users will need to bookmark the new admin URL
- All existing functionality remains the same, just accessed via different subdomain
- No data migration required

### For Existing Bookmarks
- Admin bookmarks will need to be updated to use admin subdomain
- Main domain bookmarks continue to work as before

## Testing

### Manual Testing Checklist
- [ ] Main domain shows events without sign in/up buttons
- [ ] Admin subdomain shows sign in/up buttons
- [ ] Admin routes only accessible on admin subdomain
- [ ] User routes work correctly on main domain
- [ ] Navigation adapts correctly based on subdomain
- [ ] Mobile menu works correctly on both subdomains

### URL Patterns to Test
- `domain.com` - Should show landing page with events
- `admin.domain.com` - Should redirect to admin login if not authenticated
- `admin.domain.com/admin` - Should show admin dashboard if authenticated as admin
- `domain.com/admin` - Should not be accessible (404 or redirect)
