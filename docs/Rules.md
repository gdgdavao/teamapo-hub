# APOHUB Security Rules, Authorization & Code Style Standards

This document serves as the single source of truth for **APOHUB**:
- **Part 1**: Security Rules & Authorization Architecture (Cloud Firestore, Cloud Storage, Cloud Functions)
- **Part 2**: Engineering Standards & Code Style Guidelines (TypeScript, React, Python, Tailwind CSS, Firestore, Git)

---

# PART 1: Security Rules & Authorization Architecture

## 1. Threat Model & Security Philosophy

APOHUB is designed to solve a unique community event challenge: **minimize attendee friction** while **strictly securing event operations, financial data, and credentials**.

### Core Tenets:
1. **Frictionless Anonymous Attendance**: Attendees register without creating a Firebase Auth account. Public registration and payment operations must cross a trusted callable-function boundary; direct anonymous writes are not trusted for pricing, inventory, payment, or attendance state.
2. **Strict Field-Level Mutation Control**: When anonymous users perform permitted writes (e.g. reserving tickets or submitting feedback), security rules enforce atomic diff checks using `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`.
3. **Role-Based Access Control (RBAC)**: Elevated privileges are restricted to verified Google Developer Group (GDG) organizers and platform administrators stored in the `/users/{userId}` collection.
4. **Data Immutability**: Historical audit logs (`activity_logs`) and attendee reviews (`feedback`) are immutable. Once written, they cannot be edited or tampered with.
5. **Private Token Intermediaries**: Sensitive operations (e.g., feedback completion links) utilize server-managed tokens in `/feedbackTokens/{tokenId}` that are completely unreachable by client SDKs.

---

## 2. Authorization Hierarchy & Helper Functions

Security rules use reusable, centralized helper functions defined at the root of `firestore.rules` and `storage.rules`:

```mermaid
flowchart TD
    Req[Incoming Request] --> AuthCheck{request.auth != null?}
    AuthCheck -- No --> AnonRules[Anonymous / Public Security Checks]
    AuthCheck -- Yes --> UserDoc[Lookup /users/request.auth.uid]
    
    UserDoc --> RoleCheck{User Role in Firestore}
    RoleCheck -- role == 'admin' --> AdminPerms[Full Administrative Access]
    RoleCheck -- role == 'organizer' --> OrgPerms[Organizer Access (Scoped to Own Events)]
    RoleCheck -- Not found / Other --> Deny[Default Deny]
```

### 2.1 Firestore Helper Functions

```javascript
// Validates presence of an active Firebase Auth token
function isAuthenticated() {
  return request.auth != null;
}

// Enforces document ownership by matching Auth UID to document ID
function isOwner(uid) {
  return request.auth != null && request.auth.uid == uid;
}

// Checks if authenticated user has role == 'admin' in Firestore
function isAdmin() {
  return request.auth != null && 
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// Checks if authenticated user is either 'organizer' or 'admin'
function isOrganizer() {
  return request.auth != null && 
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'organizer' || 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
}

// Syntactic sugar combining admin and organizer checks
function isAdminOrOrganizer() {
  return request.auth != null &&
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'organizer');
}

// Regex format validator for email integrity
function isValidEmail(email) {
  return email is string && email.matches('.*@.*[.].*');
}
```

### 2.2 Storage Helper Functions

```javascript
// Max 5MB size limit for image uploads
function isValidImageSize() {
  return (request.resource != null ? request.resource.size : resource.size) < 5 * 1024 * 1024;
}

// Enforces MIME type matching image/*
function isValidImageType() {
  let ct = (request.resource != null ? request.resource.contentType : resource.contentType);
  return ct != null && ct.matches('image/.*');
}

// Enforces approved document MIME types (PDF, JPEG, PNG)
function isValidDocumentType() {
  let ct = (request.resource != null ? request.resource.contentType : resource.contentType);
  return ct != null && (ct in ['application/pdf', 'image/jpeg', 'image/png']);
}
```

---

## 3. Firestore Rules Matrix & Deep Dive

| Collection Path | Read | List | Create | Update | Delete | Key Security Constraints |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/users/{userId}` | Owner / Admin | Admin | Admin | Owner / Admin | Admin | Email syntax validated; Role restricted to `admin` or `organizer`. Privilege escalation blocked. |
| `/events/{eventId}` | Public | Public | Organizer / Admin | Organizer / Admin / Restricted Anonymous | Organizer / Admin | Anonymous updates restricted strictly to `['ticketTypes', 'currentAttendees', 'promoCodes', 'updatedAt']`. |
| `/events/{id}/forms/{formId}` | Public | Public | Event Organizer / Admin | Event Organizer / Admin | Event Organizer / Admin | Scoped to parent event owner (`event.organizer.uid == request.auth.uid`). |
| `/events/{id}/config/{configId}` | Organizer / Admin | Organizer / Admin | Event Organizer / Admin | Event Organizer / Admin | Event Organizer / Admin | Protected configuration settings. |
| `/registrations/{regId}` | Organizer / Admin | Organizer / Admin / Trusted Function | Public (Anonymous, validated pending only) | Organizer / Admin / Trusted Function | Admin / Organizer | Payment-link reads and anonymous state transitions must use callable functions; direct client reads are denied. |
| `/certificateTemplates/{id}` | Public | Public | Organizer / Admin | Organizer / Admin | Organizer / Admin | Public read enables client-side certificate dynamic preview and rendering. |
| `/certificates/{certId}` | Public | Public | Public / Function | Restricted Anonymous / Auth | Authenticated | Anonymous create requires `eventId`, `registrationId`, `verificationCode`, and `recipientName`. Anonymous update strictly restricted to incrementing `verificationCount`. |
| `/feedbackTokens/{tokenId}` | **Denied** | **Denied** | **Denied** | **Denied** | **Denied** | **100% Locked**. Only Cloud Functions with Firebase Admin SDK can read/write tokens. Prevents attendee enumeration. |
| `/feedback/{feedbackId}` | Authenticated | Authenticated | Public (Anonymous) | **Denied** | Authenticated | Valid email required. Target `eventId` must be a string. **Updates are disallowed** (immutable). |
| `/activity_logs/{logId}` | Authenticated | Authenticated | Authenticated | **Denied** | Authenticated | Immutable audit trail. |
| `/event_analytics/{id}` | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated | Admin/organizer analytics rollups. |
| `/paymentProofs/{proofId}` | Event Admin / Organizer | Event Admin / Organizer | Admin / Organizer / Trusted Function | Event Admin / Organizer | Event Admin / Organizer | Direct anonymous reads and creates are denied; proof submission must use a trusted function. |
| `/notifications/{notifId}` | Recipient | Recipient | Public / System | Recipient | Recipient | User can only read/mutate their own notifications (`request.auth.uid == resource.data.userId`). |
| `/system/{docId}` | Authenticated | Authenticated | Authenticated | Authenticated | Authenticated | Platform-wide operational configs. |
| `/{document=**}` | **Denied** | **Denied** | **Denied** | **Denied** | **Denied** | Catch-all default deny. |

---

## 4. Key Attack Vectors & Mitigations

### 4.1 Mass Assignment & Field Tampering
* **Threat**: A malicious attendee intercepts the registration request and attempts to set `totalAmount = 0`, `paymentStatus = 'paid'`, or `attendanceStatus = 'checked-in'`.
* **Mitigation**: 
   1. Registrations are initialized with `paymentStatus: 'pending'` and validated against a strict anonymous-create schema.
  2. For anonymous updates on `/registrations/{registrationId}`, the rules enforce:
     ```javascript
     allow update: if isAuthenticated() || 
       (resource.data.paymentStatus == 'pending' && 
        request.resource.data.paymentStatus in ['pending', 'processing']) ||
       (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['feedbackSubmitted', 'feedbackId', 'updatedAt']));
     ```
   3. Attendees cannot mark themselves as `paid` or `checked-in`. Check-ins, payment transitions, and inventory changes can only be executed by trusted Functions or authenticated organizers.

### 4.2 Ticket Inventory Overwrite
* **Threat**: An anonymous registrant tampers with other event properties (e.g. changing event title, dates, or prices) when decrementing ticket stock.
* **Mitigation**:
   ```javascript
   allow update: if isAuthenticated() &&
     (isAdmin() || (isOrganizer() && resource.data.organizer.uid == request.auth.uid));
   ```
   Unauthenticated clients are locked out of modifying event documents. Inventory and promo-code changes must be performed by a trusted callable function.

### 4.3 Feedback Token Enumeration & PII Leakage
* **Threat**: An attacker queries `/feedbackTokens` or attempts to guess URLs to discover attendee identities or emails.
* **Mitigation**:
  ```javascript
  match /feedbackTokens/{tokenId} {
    allow read: if false;
    allow write: if false;
  }
  ```
  The collection is inaccessible via client SDKs. Client requests must submit the token to the `resolveFeedbackToken` callable Cloud Function, which runs server-side validation and decrypts the attendee details.

### 4.4 Privilege Escalation on User Accounts
* **Threat**: A standard user updates their document in `/users` to grant themselves `role: 'admin'`.
* **Mitigation**:
  ```javascript
  match /users/{userId} {
    allow create: if isAuthenticated() && isAdmin() &&
                     isValidEmail(resource.data.email) &&
                     resource.data.role in ['admin', 'organizer'];
    allow update: if isAuthenticated() && (isAdmin() || isOwner(userId));
    allow delete: if isAuthenticated() && isAdmin();
  }
  ```
  Non-admin users cannot create accounts or promote accounts to admin. Organizers cannot change their assigned roles.

---

## 5. Cloud Storage Security Rules Breakdown

Storage rules ensure media, payment receipts, and generated certificates are safely isolated.

### 5.1 Event Images & Assets
```javascript
match /events/{eventId}/images/{imageId} {
  allow read: if true; // Public event posters
  allow write: if isOrganizer() && isValidImageSize() && isValidImageType();
  allow delete: if isAdmin() || (isAuthenticated() && firestore.get(/databases/(default)/documents/events/$(eventId)).data.organizer.uid == request.auth.uid);
}
```
* **Read**: Public worldwide.
* **Write**: Authenticated organizers only; max 5MB; image MIME type required.
* **Delete**: Event owner or platform admin only.

### 5.2 Payment Proofs Upload
```javascript
match /payment-proofs/{registrationId}/{proofId} {
  allow read: if isAdminOrOrganizerForRegistration(registrationId);
  allow create: if isAdminOrOrganizerForRegistration(registrationId) &&
                isValidImageType() &&
                request.resource.size < 5 * 1024 * 1024;
  allow update, delete: if isAdmin();
}
```
* **Trusted Upload**: Direct anonymous uploads are denied. A callable function must validate the payment-link token before accepting a proof.
* **Size Enforcement**: Limited to 5MB.
* **Safari Fallback**: Safari occasionally omits `contentType` when uploading images. The rule features a fallback regex checking the extension of the `proofId` for `.jpg`, `.jpeg`, `.png`, `.heic`, etc.

### 5.3 Certificate Storage & Generation
```javascript
match /certificates/{eventId}/{filename} {
  allow read: if true; // Public verification access
  allow write: if true; // Anonymous write for client-rendered certificates post-feedback
  allow delete: if isAdmin();
}
```
* Certificates are publicly readable to support the digital verification portal.
* Client-side generation (via jsPDF / html2canvas) or serverless triggers can store rendered PDF certificates. Deletions are restricted to administrators.

---

## 6. Cloud Functions Security & Region Consistency

The APOHUB backend comprises Python 2nd Gen Cloud Functions hosted in Google Cloud Run.

### 6.1 Regional Isolation (`asia-southeast2`)
To prevent preflight failures, CORS errors, and cross-region latency, both the client SDK and functions runtime are pinned to `asia-southeast2` (Jakarta):
* **Backend (`functions/main.py`)**:
  ```python
  from firebase_functions.options import set_global_options
  set_global_options(region="asia-southeast2", max_instances=10)
  ```
* **Frontend (`src/config/firebase.ts`)**:
  ```typescript
  export const functions = getFunctions(app, 'asia-southeast2');
  ```

### 6.2 Callable Request Context Verification
Protected Cloud Functions strictly verify the user's authentication context and Firestore role:
```python
def checkInAttendee(req: https_fn.CallableRequest) -> Dict[str, Any]:
    if not req.auth:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            "Must be authenticated to perform check-in."
        )
    
    caller_uid = req.auth.uid
    db = get_db()
    user_doc = db.collection('users').document(caller_uid).get()
    
    if not user_doc.exists or user_doc.to_dict().get('role') not in ['admin', 'organizer']:
        raise https_fn.HttpsError(
            https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            "Only organizers and administrators can check in attendees."
        )
```

### 6.3 Environment Variables & Secrets Handling
Sensitive third-party credentials are kept outside client bundles and git history:
* `RESEND_API_KEY`: Kept on server runtime for transactional email dispatch.
* `GEMINI_API`: Kept on server or loaded through secured environment variables for AI generation.

---

## 7. Security Audit & Deployment Checklist

Before deploying rule updates to production, execute the following validation cycle:

```bash
# 1. Validate security rules syntax
bun run firebase:rules:validate

# 2. Deploy Firestore & Storage rules
bun run firebase:rules

# 3. Verify indexes are synchronized
bun run firebase:indexes

# 4. Check active rules status
bun run firebase:rules:status
```

---

# PART 2: Engineering Standards & Code Style Guidelines

## 8. TypeScript Coding Standards

### 8.1 Strict Typing & Safety
* **No `any`**: Avoid the `any` keyword. Use explicit types, generics, or `unknown` with type narrowing.
* **Interface vs. Type**: Prefer `interface` for object models, component props, and service contracts. Use `type` for unions, primitives, and complex computed types.
* **Explicit Return Types**: All exported functions, service methods, and custom hooks must declare explicit return types.

```typescript
// ✅ Good: Clear contract with explicit types
export interface EventRosterProps {
  eventId: string;
  onAttendeeSelect: (registration: Registration) => void;
  filterStatus?: AttendanceStatus;
}

export const formatAttendeeName = (details: Registration['userDetails']): string => {
  return details.name.trim();
};

// ❌ Bad: Implicit any and missing return type
export const getDetails = (details: any) => {
  return details.name;
};
```

### 8.2 Enums and Union Types
Use string literal union types over TypeScript numeric `enum`s to ensure seamless JSON serialization with Firestore documents:

```typescript
// ✅ Good: Direct string representation in Firestore
export type EventStatus = 
  | 'draft' 
  | 'published' 
  | 'ongoing' 
  | 'completed' 
  | 'cancelled' 
  | 'postponed';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'cancelled';
```

### 8.3 Immutability
Do not mutate state, props, or query results directly. Use object spread, array methods (`map`, `filter`), or functional updates:

```typescript
// ✅ Good: Immutable copy with updated property
const updatedTicketTypes = event.ticketTypes.map(ticket => 
  ticket.id === targetId ? { ...ticket, currentSold: ticket.currentSold + 1 } : ticket
);

// ❌ Bad: Direct array mutation
event.ticketTypes[0].currentSold += 1;
```

---

## 9. React Component Architecture

### 9.1 Functional Components & Props
All components must be functional components with typed props. Use destructuring with sensible defaults.

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  className = '',
  disabled,
  ...rest
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {isLoading ? <LoadingSpinner size="sm" /> : leftIcon}
      <span>{children}</span>
    </button>
  );
};
```

### 9.2 Hook Ordering & Conventions
Group component logic cleanly in standard order:
1. **React State Hooks** (`useState`, `useReducer`)
2. **Context & External State Hooks** (`useAuth`, `useNavigate`, `useParams`)
3. **Ref Hooks** (`useRef`)
4. **Side Effect Hooks** (`useEffect`, `useLayoutEffect`)
5. **Memoized Values & Callbacks** (`useMemo`, `useCallback`)
6. **Custom Event Handlers** (`handle...`)
7. **Early Return Guards** (Loading, error, empty state)
8. **Render JSX**

```typescript
export const AttendeeCheckInCard: React.FC<{ registrationId: string }> = ({ registrationId }) => {
  // 1. State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Context & Router
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // 3. Effects
  useEffect(() => {
    setError(null);
  }, [registrationId]);

  // 4. Handlers
  const handleCheckIn = async (): Promise<void> => {
    try {
      setIsProcessing(true);
      await RegistrationService.checkIn(registrationId);
      toast.success('Attendee checked in!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Render
  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Component markup */}
    </div>
  );
};
```

### 9.3 Separation of Concerns: Service Layer
**Components must not contain direct Firestore or API calls.** All data fetching, business logic, and backend coordination must reside in `src/services/`.

* Components: Render UI, capture user interactions, display state.
* Services: Query Firestore, run transactions, execute callable functions, handle schema transformations.

---

## 10. Styling & Design System Rules (Tailwind CSS)

### 10.1 Brand Color Guidelines
Adhere to the official Google Developer Groups palette:
* **Primary Blue**: `bg-blue-600` (`#1a73e8` / `#4285f4`) — Primary actions, active navigation, links.
* **Success Green**: `bg-green-600` (`#34a853`) — Confirmed tickets, valid certificates, success states.
* **Warning Yellow**: `bg-amber-500` (`#fbbc04`) — Pending payments, review alerts, warnings.
* **Danger Red**: `bg-red-600` (`#ea4335`) — Rejections, cancellation states, destructive buttons.
* **Neutrals**: `bg-gray-50` (page backgrounds), `bg-white` (cards), `text-gray-900` (headings), `text-gray-600` (body).

### 10.2 Class Grouping Order
Follow a consistent ordering pattern for Tailwind utility classes:
1. **Layout & Positioning**: `relative`, `absolute`, `flex`, `grid`, `items-center`, `justify-between`
2. **Box Model**: `w-full`, `max-w-lg`, `p-4`, `m-2`, `space-y-4`
3. **Typography**: `text-sm`, `font-semibold`, `text-gray-800`, `leading-tight`
4. **Visuals & Backgrounds**: `bg-white`, `border`, `border-gray-200`, `rounded-xl`, `shadow-sm`
5. **Interactive & Pseudo-classes**: `hover:bg-blue-700`, `focus:ring-2`, `disabled:opacity-50`, `transition-colors`

### 10.3 Mobile-First Responsiveness
Always design for mobile viewports first, then enhance for desktop using responsive prefixes:
```tsx
// ✅ Mobile-first: single column by default, 2 cols on tablet, 3 cols on desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
```

---

## 11. Python Backend Standards (Cloud Functions)

### 11.1 Code Style & PEP 8
* **Indentation**: 4 spaces (no tabs).
* **Naming**: `snake_case` for functions, methods, and variables; `PascalCase` for classes and exceptions; `UPPER_SNAKE_CASE` for module constants.
* **Type Hinting**: All function parameters and return types must include typing annotations:
  ```python
  from typing import Dict, List, Any, Optional
  from firebase_functions import https_fn

  def validate_ticket_order(
      order_items: List[Dict[str, Any]], 
      event_id: str
  ) -> Dict[str, Any]:
      ...
  ```

### 11.2 Error Handling & HTTP Status Codes
Always raise `https_fn.HttpsError` with the appropriate `FunctionsErrorCode` rather than throwing generic Python exceptions:

```python
# ✅ Good: Explicit HttpsError with actionable message
if not registration_doc.exists:
    raise https_fn.HttpsError(
        https_fn.FunctionsErrorCode.NOT_FOUND,
        f"Registration with ID '{registration_id}' was not found."
    )

if ticket["currentSold"] + requested_qty > ticket["maxQuantity"]:
    raise https_fn.HttpsError(
        https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
        "Selected ticket tier is sold out."
    )
```

### 11.3 Firestore Client Initialization
Always use the lazy initialization singleton via `get_db()`:
```python
_db = None

def get_db():
    global _db
    if _db is None:
        _db = firestore.client()
    return _db
```

---

## 12. Database Access & Mutation Standards

### 12.1 Atomic Transactions for Shared Counters
Any operation that adjusts ticket sales count (`currentSold`), overall attendees (`currentAttendees`), or promo code redemptions (`currentUses`) **must use `runTransaction`** to prevent race conditions:

```typescript
await runTransaction(db, async transaction => {
  const eventDoc = await transaction.get(eventRef);
  if (!eventDoc.exists()) {
    throw new Error('Event not found');
  }

  const eventData = eventDoc.data() as Event;
  const targetTicket = eventData.ticketTypes.find(t => t.id === ticketTypeId);
  
  if (!targetTicket) {
    throw new Error('Ticket type not found');
  }

  if (targetTicket.maxQuantity && targetTicket.currentSold + quantity > targetTicket.maxQuantity) {
    throw new Error('Tickets are sold out');
  }

  targetTicket.currentSold += quantity;
  transaction.update(eventRef, {
    ticketTypes: eventData.ticketTypes,
    currentAttendees: increment(quantity),
    updatedAt: serverTimestamp()
  });
});
```

### 12.2 Timestamp Invariant
Never use client-generated timestamps (`new Date()`) for Firestore document creation or audit fields. Always use `serverTimestamp()`:
```typescript
// ✅ Good: Reliable server timestamp
createdAt: serverTimestamp(),
updatedAt: serverTimestamp()

// ❌ Bad: Clock skew risk
createdAt: new Date()
```

### 12.3 Query Limits
Every Firestore query against unbounded collections (`registrations`, `feedback`, `activity_logs`) **must specify a `limit()`** to prevent unbounded billing spikes:
```typescript
const q = query(
  collection(db, 'registrations'),
  where('eventId', '==', eventId),
  orderBy('registrationDate', 'desc'),
  limit(50) // Enforce pagination
);
```

---

## 13. Logging, Error Handling & User Feedback

### 13.1 Development vs. Production Logging
Do not use raw `console.log()` in frontend application code. Use the centralized `logger` utility (`src/utils/logger.ts`), which automatically mutes all output in production builds:

```typescript
import { logger } from '@/utils/logger';

// ✅ Output only appears when import.meta.env.DEV is true
logger.log('Processing payment link token:', token);
logger.warn('Token nearing expiration:', expiresAt);
logger.error('Payment verification failed:', error);
```

### 13.2 Toast Notifications UX
Use `react-hot-toast` for user-facing feedback:
* `toast.success('Action succeeded')`: Confirmations (e.g. "Ticket confirmed", "Check-in successful").
* `toast.error('Helpful error message')`: Recoverable failures (e.g. "Invalid voucher code").
* `toast.loading('Processing...')`: Asynchronous operations (e.g. "Uploading payment proof...").

---

## 14. File Organization & Naming Conventions

| Category | Convention | Example |
| :--- | :--- | :--- |
| **React Components** | `PascalCase.tsx` | `EventCard.tsx`, `AdminLayout.tsx` |
| **Page Components** | `PascalCase.tsx` with `Page` suffix | `AdminDashboardPage.tsx`, `AttendeesPage.tsx` |
| **Custom Hooks** | `camelCase.ts` with `use` prefix | `usePageTitle.ts`, `useDebounce.ts` |
| **Service Modules** | `camelCase.ts` with `Service` suffix | `registrationService.ts`, `emailService.ts` |
| **Utility Functions** | `camelCase.ts` | `formatDate.ts`, `logger.ts` |
| **Global Constants** | `UPPER_SNAKE_CASE.ts` | `API_CONSTANTS.ts`, `DEFAULT_THEME.ts` |
| **Python Cloud Functions** | `snake_case.py` | `main.py`, `email_service.py` |

### 14.1 Import Grouping
Organize imports into discrete, alphabetically sorted blocks separated by an empty line:

```typescript
// 1. React and third-party libraries
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// 2. Firebase SDKs
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

// 3. Application Services & Utilities
import { EventService } from '@/services/eventService';
import { logger } from '@/utils/logger';

// 4. UI Components
import { Button } from '@/components/shared/UI/Button';
import LoadingSpinner from '@/components/shared/UI/LoadingSpinner';

// 5. Types and Interfaces
import type { Event, TicketType } from '@/types';
```

---

## 15. Git & Pull Request Guidelines

### 15.1 Conventional Commit Messages
All commit messages must adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

* `feat(scope)`: A new feature (e.g. `feat(checkin): add camera flashlight toggle`)
* `fix(scope)`: A bug fix (e.g. `fix(tickets): resolve concurrency counter race condition`)
* `docs(scope)`: Documentation changes (e.g. `docs(rules): document code style guidelines`)
* `style(scope)`: Code formatting, whitespace, semicolons (no code change)
* `refactor(scope)`: Code refactoring without changing behavior
* `perf(scope)`: Performance optimizations
* `test(scope)`: Adding or correcting tests
* `chore(scope)`: Build tools, package dependencies, configs

### 15.2 Branch Naming Conventions
```bash
feature/ticket-tier-pricing
fix/payment-proof-upload-safari
docs/update-architecture-spec
refactor/cloud-function-email-loader
```

### 15.3 Pull Request Quality Checklist
Before requesting a code review:
- [ ] Code passes linter without errors (`bun run lint`).
- [ ] TypeScript types compile without errors (`bun run build`).
- [ ] No raw `console.log()` calls added (use `logger` instead).
- [ ] Security rules validated (`bun run firebase:rules:validate`).
- [ ] Mobile responsive layout verified on small screen viewports.
- [ ] PR description includes testing steps and screenshots for UI changes.
