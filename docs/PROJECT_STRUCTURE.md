# APOHUB Project Structure

## Root Directory
```
apohub-gdgdavao/
├── package.json          # Project dependencies and scripts
├── bun.lock              # Dependency lock file (Bun)
├── env.example           # Environment variables template
├── index.html            # Main HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
├── eslint.config.js      # ESLint configuration
├── README.md             # Main project documentation
└── .gitignore            # Git ignore rules
```

## Source Code Structure (`src/`)

### Application Core
- `main.tsx` - Application entry point with React Router and Toast setup
- `App.tsx` - Main app component with routing configuration
- `index.css` - Global styles with Tailwind CSS and custom components

### Configuration
- `config/firebase.ts` - Firebase service initialization and configuration

### Type Definitions
- `types/index.ts` - Comprehensive TypeScript interfaces for the entire system

### Authentication
- `contexts/AuthContext.tsx` - Firebase authentication context and user management

### UI Components
```
components/
├── Layout/
│   ├── Layout.tsx        # Main layout wrapper
│   ├── Header.tsx        # Navigation header with GDG branding
│   └── Footer.tsx        # Footer with links and branding
└── UI/
    └── LoadingSpinner.tsx # Reusable loading component
```

### Pages Structure
```
pages/
├── public/               # Public-facing pages (no auth required)
│   ├── LandingPage.tsx   # Homepage with GDG-inspired design
│   ├── EventsPage.tsx    # Lu.ma-inspired event listings
│   ├── EventDetailPage.tsx # Individual event details
│   └── RegisterPage.tsx  # Event registration form
├── auth/                 # Authentication pages
│   ├── LoginPage.tsx     # Sign in with Google integration
│   ├── SignUpPage.tsx    # User registration
│   └── ForgotPasswordPage.tsx # Password reset
├── attendee/             # Attendee dashboard pages
│   ├── DashboardPage.tsx # Personal dashboard
│   ├── MyEventsPage.tsx  # Registered events
│   ├── MyCertificatesPage.tsx # Certificate management
│   └── ProfilePage.tsx   # Profile settings
├── organizer/            # Organizer-only pages
│   ├── OrganizerDashboardPage.tsx # Organizer dashboard
│   ├── CreateEventPage.tsx # Event creation form
│   ├── ManageEventsPage.tsx # Event management
│   ├── EventAnalyticsPage.tsx # Event analytics
│   └── AttendeesPage.tsx # Attendee management
├── payment/              # Payment processing pages
│   ├── PaymentPage.tsx   # Paymongo integration
│   └── PaymentSuccessPage.tsx # Payment confirmation
├── feedback/             # Post-event feedback
│   └── FeedbackPage.tsx  # Feedback collection form
├── verification/         # Certificate verification
│   └── CertificateVerificationPage.tsx # Public certificate verification
└── error/                # Error pages
    └── NotFoundPage.tsx  # 404 error page
```

## Key Features Implemented

### 🎨 Design System
- **Google Brand Colors**: Primary blue (#4285f4), red (#ea4335), yellow (#fbbc04), green (#34a853)
- **Typography**: Google Sans and Roboto fonts
- **Components**: Material Design-inspired buttons, cards, and form inputs
- **Animations**: Smooth transitions and hover effects

### 🔐 Authentication System
- Firebase Authentication integration
- Google Sign-In support
- Email/password authentication
- User profile management
- Role-based access control (attendee, organizer, admin)

### 🧭 Navigation & Routing
- React Router v7 integration
- Protected routes for authenticated users
- Role-based route protection
- Mobile-responsive navigation
- Breadcrumb navigation support

### 🎯 User Experience
- **Landing Page**: GDG-inspired hero section with feature highlights
- **Event Discovery**: Lu.ma-inspired clean event listings
- **Dashboard**: GDG community-style organizer interface
- **Mobile-First**: Responsive design across all devices

### 🛠️ Development Infrastructure
- **TypeScript**: Full type safety across the application
- **Vite**: Lightning-fast development and builds
- **Bun**: Ultra-fast package management
- **Tailwind CSS**: Utility-first styling with custom design system
- **ESLint**: Code quality and consistency

## Technology Stack Summary

### Frontend
- **React 19** - Latest React with concurrent features
- **TypeScript 5.7** - Static typing and enhanced DX
- **Vite 6** - Next-generation frontend tooling
- **Tailwind CSS 3.4** - Utility-first CSS framework

### Backend Services (Ready for Integration)
- **Firebase 11** - Authentication, Firestore, Functions, Storage
- **Paymongo** - Philippine payment processing (QRPH, GCash, etc.)

### Development Tools
- **Bun** - Fast JavaScript runtime and package manager
- **ESLint** - Code linting and quality assurance
- **PostCSS** - CSS processing and optimization

### UI Libraries
- **Headless UI** - Unstyled, accessible UI components
- **Heroicons** - Beautiful hand-crafted SVG icons
- **Lucide React** - Additional icon library
- **React Hot Toast** - Elegant notification system

### Additional Libraries
- **React Hook Form** - Performant form handling
- **date-fns** - Modern date utility library
- **QRCode** - QR code generation for attendance
- **jsPDF** - PDF generation for certificates
- **html2canvas** - Screenshot generation

## Next Steps for Full Implementation

### 1. Firebase Setup
- Create Firebase project
- Configure authentication providers
- Set up Firestore database with security rules
- Deploy Firebase Functions for serverless logic

### 2. Complete Page Implementations
- Build event creation and management forms
- Implement registration and payment flows
- Create analytics dashboards
- Build certificate generation system

### 3. Payment Integration
- Integrate Paymongo API
- Implement QRPH payment flows
- Set up webhook handlers
- Add payment status tracking

### 4. Advanced Features
- Real-time attendance tracking
- Email notification system
- Certificate verification portal
- Advanced analytics and reporting

## Development Guidelines

### Code Organization
- Components should be single-responsibility
- Use TypeScript interfaces for all data structures
- Follow React best practices for hooks and state management
- Implement proper error boundaries

### Styling Conventions
- Use Tailwind utility classes
- Follow mobile-first responsive design
- Maintain Google brand consistency
- Use semantic HTML for accessibility

### State Management
- React Context for global state (auth, theme)
- Local state for component-specific data
- Firebase real-time listeners for live data

This structure provides a solid foundation for the complete APOHUB system while maintaining scalability, maintainability, and adherence to modern web development best practices. 