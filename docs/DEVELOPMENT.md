# APOHUB Development Guide

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## 🎯 Project Overview

APOHUB is a modern event management platform built for GDG Davao community. It provides:
- Event creation and management
- Ticket sales and payment processing (Paymongo)
- QR code-based attendance tracking
- Certificate generation
- Analytics and reporting

### Tech Stack
- **Frontend**: React 19 + TypeScript 5.7
- **Build Tool**: Vite 6
- **Package Manager**: Bun
- **Styling**: Tailwind CSS 3.4
- **Backend**: Firebase 11 (Auth, Firestore, Functions, Storage)
- **Payment**: Paymongo API
- **Icons**: Heroicons + Lucide React
- **Forms**: React Hook Form
- **PDF Generation**: jsPDF + html2canvas

## 🔧 Prerequisites

Before starting development, ensure you have:

### Required Software
- **Node.js 18+** or **Bun 1.0+** (recommended)
- **Git** for version control
- **Firebase CLI** for deployment
- **Code Editor** (VS Code recommended)

### Required Accounts
- **Firebase Account** with a configured project
- **Paymongo Account** (for Philippine payment processing)
- **GitHub Account** for version control

### VS Code Extensions (Recommended)
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "ms-vscode.vscode-css"
  ]
}
```

## 🚀 Local Development Setup

### 1. Clone and Install
```bash
# Clone the repository
git clone https://github.com/gdgdavao/apohub.git
cd apohub-gdgdavao

# Install dependencies using Bun (faster)
bun install

# Or using npm
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp env.example .env.local

# Edit environment variables
# Add your Firebase and Paymongo credentials
```

### 3. Firebase Setup

#### Create Firebase Project
1. Visit [Firebase Console](https://console.firebase.google.com)
2. Create a new project named "apohub-gdgdavao"
3. Enable Authentication, Firestore, and Storage

#### Configure Authentication
```bash
# Enable Google Sign-In
# In Firebase Console:
# Authentication > Sign-in method > Google > Enable
# Add your domain to authorized domains
```

#### Set up Firestore Database
```javascript
// Security Rules (firestore.rules)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Events are publicly readable
    match /events/{eventId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Registrations are private
    match /registrations/{registrationId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Paymongo Setup
1. Sign up at [Paymongo Dashboard](https://dashboard.paymongo.com)
2. Get API keys from Developers section
3. Add keys to `.env.local`

### 5. Start Development Server
```bash
# Using Bun (recommended)
bun run dev

# Or using npm
npm run dev
```

The application will be available at `http://localhost:5173`

## 🏗️ Project Architecture

### Directory Structure
```
src/
├── assets/           # Static assets (images, icons)
├── components/       # Reusable UI components
│   ├── Layout/      # Layout components
│   └── UI/          # General UI components
├── config/          # Configuration files
├── contexts/        # React contexts
├── pages/           # Page components
│   ├── public/      # Public pages
│   ├── auth/        # Authentication pages
│   ├── attendee/    # Attendee dashboard
│   ├── organizer/   # Organizer dashboard
│   ├── payment/     # Payment pages
│   └── error/       # Error pages
├── types/           # TypeScript definitions
├── App.tsx          # Main app component
├── index.css        # Global styles
└── main.tsx         # Application entry point
```

### Component Architecture

#### Component Naming Convention
- **Pages**: `PascalCase` + `Page` suffix (e.g., `EventDetailPage.tsx`)
- **Components**: `PascalCase` (e.g., `EventCard.tsx`)
- **Contexts**: `PascalCase` + `Context` suffix (e.g., `AuthContext.tsx`)

#### Component Structure
```typescript
// components/EventCard.tsx
interface EventCardProps {
  event: Event;
  onRegister?: (eventId: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  onRegister 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Component content */}
    </div>
  );
};
```

### State Management Strategy

#### Local State
Use `useState` and `useReducer` for component-specific state.

#### Global State
Use React Context for application-wide state:
- `AuthContext` - User authentication and profile
- `ThemeContext` - UI theme and preferences (if needed)

#### Server State
Use Firebase real-time listeners for live data:
```typescript
// Example: Real-time events
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'events'),
    (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(events);
    }
  );

  return unsubscribe;
}, []);
```

## 🔄 Development Workflow

### Git Workflow
1. **Create Feature Branch**
   ```bash
   git checkout -b feature/event-registration
   ```

2. **Make Changes**
   - Follow coding standards
   - Write meaningful commit messages
   - Test your changes

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add event registration functionality"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/event-registration
   ```

### Branch Naming Convention
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions

### Commit Message Format
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
type(scope): description

Examples:
feat(auth): add Google sign-in integration
fix(events): resolve date display issue
docs(readme): update installation instructions
```

## 📏 Coding Standards

### TypeScript Guidelines
```typescript
// Use strict typing
interface User {
  id: string;
  email: string;
  name: string;
  role: 'attendee' | 'organizer' | 'admin';
  createdAt: Date;
}

// Prefer interfaces over types for object shapes
interface EventProps {
  event: Event;
  readonly?: boolean;
}

// Use enums for constants
enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}
```

### React Best Practices
```typescript
// Use functional components with hooks
const EventList: React.FC<EventListProps> = ({ events, loading }) => {
  // Group related state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  // Memoize expensive calculations
  const sortedEvents = useMemo(
    () => events.sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events]
  );

  // Extract custom hooks for reusable logic
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="space-y-4">
      {loading ? (
        <LoadingSpinner />
      ) : (
        sortedEvents.map(event => (
          <EventCard 
            key={event.id} 
            event={event}
            onSelect={setSelectedEvent}
          />
        ))
      )}
    </div>
  );
};
```

### CSS/Tailwind Guidelines
```typescript
// Use semantic class combinations
const Button: React.FC<ButtonProps> = ({ children, variant = 'primary' }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
};
```

### File Organization
```typescript
// Group imports logically
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/UI/Button';
import { useAuth } from '@/contexts/AuthContext';
import type { Event } from '@/types';

// Export at the bottom
export { EventDetailPage };
```

## 🧪 Testing Guidelines

### Unit Testing Setup
```bash
# Install testing dependencies
bun add -d vitest @testing-library/react @testing-library/jest-dom
```

### Test Structure
```typescript
// __tests__/EventCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { EventCard } from '../EventCard';

const mockEvent: Event = {
  id: '1',
  title: 'Test Event',
  date: new Date('2024-12-01'),
  location: 'Test Location'
};

describe('EventCard', () => {
  it('renders event information correctly', () => {
    render(<EventCard event={mockEvent} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Test Location')).toBeInTheDocument();
  });

  it('calls onRegister when register button is clicked', () => {
    const mockOnRegister = vi.fn();
    render(<EventCard event={mockEvent} onRegister={mockOnRegister} />);
    
    fireEvent.click(screen.getByText('Register'));
    expect(mockOnRegister).toHaveBeenCalledWith('1');
  });
});
```

### Running Tests
```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## 🚀 Deployment

### Production Build
```bash
# Build for production
bun run build

# Preview production build locally
bun run preview
```

### Firebase Hosting Deployment
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase hosting
firebase init hosting

# Deploy to Firebase
firebase deploy
```

### Environment Variables for Production
Ensure all environment variables are properly set in your deployment platform:
- Firebase configuration
- Paymongo API keys
- Application URL

## 🔍 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules bun.lockb
bun install

# Clear Vite cache
rm -rf .vite
```

#### TypeScript Errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Update TypeScript
bun add -d typescript@latest
```

#### Firebase Connection Issues
1. Verify environment variables in `.env.local`
2. Check Firebase project configuration
3. Ensure Firebase CLI is authenticated
4. Verify Firestore security rules

#### Paymongo Integration Issues
1. Verify API keys are correct
2. Check if using test vs production keys
3. Ensure webhook URLs are properly configured

### Debug Mode
Enable debug logging by adding to `.env.local`:
```bash
VITE_DEBUG=true
```

### Performance Monitoring
Use React DevTools and Firebase Performance Monitoring for debugging performance issues.

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Paymongo API Documentation](https://developers.paymongo.com)
- [Vite Documentation](https://vitejs.dev)

## 🤝 Getting Help

- **GitHub Issues**: Report bugs and request features
- **GDG Davao Community**: Join our Discord/Slack for discussions
- **Email**: davao.gdg@gmail.com for critical issues

---

Happy coding! 🚀 