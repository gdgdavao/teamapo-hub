# TeamApo Hub System Architecture Documentation

This document provides a comprehensive technical architecture overview of **TeamApo Hub**, the event lifecycle management platform engineered for the **Google Developer Group (GDG) Davao** community.

---

## 1. Executive Summary & Architectural Overview

TeamApo Hub is a modern, serverless cloud platform built to automate and centralize all stages of event operations:

* **Event Design & Publication**: Rich event configuration, multi-tier ticketing, custom registration forms, and speaker showcases.
* **Frictionless Registration**: Attendee registration without mandatory account creation.
* **Payments**: Manual verification — bank transfer / GCash receipt upload feeding an organizer review queue that releases the ticket. No third-party payment gateway is integrated.
* **On-Site Operations**: Camera-based QR code badge check-in with real-time analytics.
* **Automated Communications**: Context-aware transactional emails (confirmations, QR tickets, 24h/1h reminders, post-event feedback invitations) sent via Resend.
* **Post-Event Workflows**: Token-secured survey feedback, dynamic PDF certificate generation, and an open verification portal.
* **AI Assistance**: Gemini-powered social media captioning and event feedback sentiment analysis.

```mermaid
flowchart TB
    subgraph ClientLayer["Frontend Client (Vercel CDN)"]
        SPA["React 19 + TypeScript SPA"]
        Router["React Router v7 Routing Engine"]
        Context["AuthContext & State Store"]
        Services["Client Service Layer (Firebase v11)"]
        CanvasEngine["Canvas / jsPDF Certificate Engine"]
        ZXing["ZXing QR Scanner Engine"]
    end

    subgraph FirebaseLayer["Backend Infrastructure (Google Cloud / asia-southeast2)"]
        Auth["Firebase Authentication (Admin/Org)"]
        Firestore["Cloud Firestore (NoSQL DB)"]
        Storage["Cloud Storage (Media & Assets)"]
        
        subgraph CloudFunctions["Python 2nd Gen Cloud Functions"]
            CallableAPI["Callable HTTPS Endpoints (26 functions)"]
            EventTriggers["Firestore Event Triggers (on_created, on_updated)"]
            EmailModule["Email Engine (Jinja2 Templates)"]
        end
    end

    subgraph ExternalServices["External Third-Party APIs"]
        Resend["Resend Email API (Transaction Deliveries)"]
        Gemini["Google AI Studio (Gemini 2.x / 1.5)"]
    end

    SPA --> Services
    Services --> Auth
    Services --> Firestore
    Services --> Storage
    Services --> CallableAPI
    
    CallableAPI --> Firestore
    CallableAPI --> Storage
    EventTriggers --> Firestore
    
    CloudFunctions --> Resend
    Services --> Gemini
```

---

## 2. Technology Stack & Specifications

### 2.1 Frontend Stack
* **Framework**: [React 19.2](https://react.dev) + [TypeScript 5.7](https://www.typescriptlang.org)
* **Build Tool & Bundler**: [Vite 6.3](https://vitejs.dev) with Fast Refresh
* **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com) with Google Material / Google Developer Group brand color palette
* **Routing**: [React Router 7.0](https://reactrouter.com) (Browser Router with declarative nested routes and layout wrappers)
* **Forms & Validation**: [React Hook Form 7.54](https://react-hook-form.com)
* **Icons & UI Primitives**: `@heroicons/react 2.2`, `lucide-react 0.46`, `@headlessui/react 2.2`
* **Client-Side QR Operations**: `@zxing/browser 0.1.5` (camera barcode scanning) + `qrcode 1.5.4` (SVG/Canvas generation)
* **Certificate Rendering**: `jspdf 2.5.2` + `html2canvas 1.4.1` + HTML5 Canvas API
* **AI Integration**: `@google/genai 1.15.0` (Google Gen AI SDK with custom local storage response caching)
* **Analytics**: `@vercel/analytics 1.5.0`

### 2.2 Backend & Cloud Services
* **Cloud Provider**: Google Cloud Platform / Firebase
* **Region**: `asia-southeast2` (Jakarta) — pinned globally across Firestore, Cloud Functions, and Cloud Storage for minimal latency in the Philippines
* **Database**: Cloud Firestore (Enterprise NoSQL database with client and server SDKs)
* **Object Storage**: Cloud Storage for Firebase (isolated buckets for event banners, templates, payment proofs, and certificates)
* **Serverless Compute**: Python 2nd Generation Cloud Functions (`firebase-functions 0.4.3`, `firebase_admin 7.1.0`, `Flask 3.1.2`, `functions-framework 3.9.2`) running on Google Cloud Run
* **Templating Engine**: `Jinja2 3.1.6` for responsive HTML email rendering

### 2.3 External Integrations
* **Payment Gateway**: None. Payment methods (bank transfer, GCash) are configured per event by the organizer and settled offline; release of a ticket is gated on manual proof review.
* **Email Service**: [Resend](https://resend.com) API (DKIM/SPF-verified domain sending with delivery webhook tracking)
* **AI Engine**: Google AI Studio (Gemini Flash / Pro models for automated social copy and survey sentiment distillation)

---

## 3. Frontend Architecture

### 3.1 Application File Structure
```
src/
├── App.tsx                      # Root route configuration & layout definitions
├── main.tsx                     # React DOM entry point
├── config/
│   └── firebase.ts              # Firebase Client SDK initialization & emulator detection
├── auth/                        # Authorization: permission model, provider, route gate
│   ├── ability.ts               # Pure CASL rule table + entity tagging helpers
│   ├── AbilityProvider.tsx      # Publishes the signed-in user's ability
│   └── RequireAbility.tsx       # Route gate; RequireAnonymous for the sign-in area
├── contexts/
│   └── AuthContext.tsx          # Firebase session + live users-document profile
├── hooks/
│   └── usePageTitle.ts          # Context-aware browser tab title updater
├── types/
│   └── index.ts                 # Central TypeScript interfaces, ROLES, and data models
├── services/                    # Domain-driven service layer
│   ├── aiService.ts             # Gemini SDK wrapper with LRU localStorage cache
│   ├── analyticsService.ts      # Event analytics aggregation and metrics
│   ├── certificateService.ts    # Template composition, verification, and retrieval
│   ├── emailService.ts          # Email dispatch calls and activity log queries
│   ├── eventService.ts          # Event CRUD, slug resolution, and capacity tracking
│   ├── feedbackService.ts       # Survey validation, token exchange, and analytics
│   ├── formService.ts           # Dynamic form builder schema helpers
│   ├── notificationService.ts   # In-app organizer alerts
│   ├── paymentService.ts        # Manual proof upload & verification workflow
│   ├── registrationService.ts   # Atomic ticket checkout, reservation, and check-in
│   └── userService.ts           # User and role administration
├── pages/
│   ├── admin/                   # Dashboards, user management, analytics, payment review
│   ├── organizer/               # Organizer dashboard (workspace pages are shared)
│   ├── public/                  # Public event registration landing page
│   ├── payment/                 # Proof upload portal and transaction status screens
│   ├── feedback/                # Attendee feedback submission portal
│   ├── verification/            # Public certificate authenticity validator
│   ├── shared/                  # Certificates workspace (role-gated, not public)
│   └── auth/                    # Login, password reset (self-signup is intentionally absent)
├── config/
│   └── app.ts                   # Canonical APP_URL + QR verification hosts
└── components/                  # Reusable UI components
    ├── admin/                   # Admin-only widgets
    ├── organizer/               # Organizer-specific widgets
    ├── shared/                  # DashboardShell, navbar, SkipLink, form builder/renderer
    │   └── UI/                  # Button, Input, Badge, Card, Modal, Tabs, DataTable, spinners
    └── public/                  # Ticket selector, promo codes, registration form
```

### 3.2 Routing & Access Control Hierarchy

Routes use a **single role-neutral namespace**. Data scoping — not route paths —
is what separates admins from organizers, so a new page only needs one route.

Authorization is a **CASL ability** built in `src/auth/ability.ts` from the
signed-in user's profile. It is a UX layer: `firestore.rules` remains the only
security boundary. `RequireAbility` reads it and turns a denial into a
destination.

| Route | Gate | Page |
| :--- | :--- | :--- |
| `/auth/login`, `/auth/forgot-password` | `RequireAnonymous` | Sign in, password reset |
| `/login`, `/signup` | — | Legacy aliases redirecting to `/auth/login` |
| `/`, `/dashboard` | `RequireAbility read Event` | `RoleBasedDashboard` renders the admin or organizer dashboard |
| `/events`, `/events/create`, `/events/edit/:eventId` | `RequireAbility read all` | Platform-wide event list and editor (admin only) |
| `/events/:eventId`, `/events/:eventId/:tab` | `RequireAbility read Event`, then `EventWorkspacePage` checks `manage` against the loaded event | Per-event workspace |
| `/attendees`, `/check-in`, `/payments`, `/emails`, `/analytics`, `/certificates` | `RequireAbility read Event` | Legacy forwarders into the workspace tab of the same name |
| `/users` | `RequireAbility read User` | User administration (admin only) |
| `/forbidden` | open | Signed in but not permitted; says which role was needed |
| `/e/:slug`, `/events/:eventId/register`, `/payment/*`, `/feedback/:eventId`, `/verify/:code` | open | Attendee-facing |
| `*` | — | 404 |

Two distinctions the gate depends on:

- **Authentication and permission are different failures.** Signed out goes to
  the login form carrying `?from=`, so a deep link survives the detour.
  `LoginPage` re-validates `?from=` rather than trusting it. Signed in without
  permission goes to `/forbidden`, which can explain why.
- **Ownership is checked where the entity is, not in the gate.** CASL ignores a
  rule's conditions when the argument is a subject *type*, so
  `can('manage', 'Event')` answers true for an organizer whose `manage Event`
  rule is conditioned on ownership. Route gates therefore only use the
  unconditioned `read` verbs; `EventWorkspacePage` checks
  `can('manage', asEvent(event))` once it has loaded the event, and a
  non-owner falls through to the same "Event not found" shell — they should not
  learn the event exists.

`tests/unit/routeIntegrity.test.ts` parses the route table and fails the build if any
`Link`/`navigate` target does not resolve, so a stale path cannot reach production.
`tests/unit/ability.test.ts` pins the rule table, and
`tests/dom/requireAbility.test.tsx` pins the gate's four outcomes.

**Data scoping (Data Privacy Act 2012).** `registrations`, `feedback` and `activity_logs`
are flat collections whose documents carry both `eventId` and a denormalized `organizerUid`.
`firestore.rules` scopes them with `ownsDocByEventId()`, so an organizer can only ever read or
modify records for events they own — they cannot read another organizer's attendee PII.
Existing documents are backfilled by `scripts/backfill-organizer-uid.cjs`; documents without
the field fall back to an event-ownership check until backfilled.

### 3.3 Dynamic Certificate Engine
Certificates are generated via client-side composition or Cloud Functions:
1. The background artwork (`certificateTemplates/{templateId}`) is retrieved from Cloud Storage.
2. An off-screen HTML5 Canvas draws the high-resolution background (1920x1080 or custom dimensions).
3. The engine dynamically maps:
   * Recipient full name with automatic font scaling to prevent overflow.
   * Event title, dates, and organizers' signatures.
   * A cryptographic QR code encoding the public verification URL (`/verify/{verificationCode}`).
4. The canvas exports a lossless PNG/PDF that is uploaded directly to `certificates/{eventId}/{filename}` in Cloud Storage and indexed in Firestore.

---

## 4. Serverless Backend Architecture (Python Cloud Functions)

The serverless backend in `functions/main.py` is implemented using **Python 3.11** and Google Cloud Functions 2nd Generation (built atop Google Cloud Run).

### 4.1 Function Endpoints Catalog

#### Event & Catalog Management
* `validate_event_data` / `validateEventData`: Validates event payload dates, ticketing limits, and required fields.
* `initialize_event`: Seeds default subcollections, forms, and analytics documents for a new event.
* `publish_event`: Atomic publishing toggle with sanity validation.
* `duplicate_event`: Deep-copies an existing event document and its ticket configurations.
* `deleteEventData`: Cascading deletion of event subcollections, registrations, proofs, and analytics.
* `get_event_statistics` / `getEventStatistics` / `getEventAnalytics`: Real-time calculation of ticket velocity, gross volume, and check-in rates.

#### Registration & Payments
* `validateRegistration`: Verifies ticket availability, promo code validity, and order limits.
* `registerForEvent`: Atomically records the registration, updates ticket sales counts, and dispatches confirmation emails.
* `processPaymentVerification`: Admin approval/rejection of manual payment proofs; transitions registration status to `'paid'` and sends ticket email.
* `bulkProcessPayments`: Batch approval for high-volume registration queues.

#### Attendance & Feedback
* `checkInAttendee`: Validates scanned QR payload, updates `attendanceStatus = 'checked-in'`, records `checkInTime`, and creates an activity log.
* `resolveFeedbackToken`: Resolves a one-time token into attendee details without exposing emails in the client URL.
* `submitFeedback`: Validates survey responses, stores feedback immutably, and triggers certificate generation.
* `sendFeedbackRequest`: Sends an individual post-event feedback invitation email.
* `resendEventFeedbackRequests`: Broadcasts feedback invitations to all attendees marked `'checked-in'` for an event.

#### Digital Credentials & Verification
* `generateCertificate`: Server-side fallback rendering and indexing of digital certificates.
* `sendCertificateNotification`: Dispatches the completed certificate notification with direct verification and download links.

#### Communications & Monitoring
* `sendConfirmationEmail`: Dispatches registration confirmation with embedded QR check-in ticket.
* `sendPaymentNotification`: Dispatches receipt or payment instructions.
* `sendEventReminder`: Scheduled/manual broadcast sent 24h and 1h prior to event start.
* `sendCheckInNotification`: Sends a welcome email upon badge check-in at the venue.
* `getResendEmailStatus` / `getAllResendEmails`: Connects to Resend API to retrieve live delivery, bounce, and open metrics.
* `health_check`: HTTP probe for uptime monitors.

### 4.2 Event-Driven Firestore Triggers
* `on_event_created` (`events/{eventId}`): Automatically provisions initial analytics documents and audit logs upon new event creation.
* `on_event_updated` (`events/{eventId}`): Watches for critical changes (e.g. status transition to `'cancelled'` or date changes) and triggers automated attendee broadcast alerts.

---

## 5. Core System Workflows

### 5.1 Attendee Registration & Payment Processing

```mermaid
sequenceDiagram
    autonumber
    actor Attendee
    participant Web as TeamApo Hub Frontend
    participant PyFn as Cloud Functions
    participant FS as Firestore
    participant Email as Resend Email Service

    Attendee->>Web: Selects tickets & fills form (/e/:slug)
    Web->>PyFn: validateRegistration(orderData)
    PyFn-->>Web: Validation OK (ticket available, promo applied)

    alt Free Event (Price == 0)
        Web->>FS: Create /registrations doc (status: 'confirmed', payment: 'paid')
        Web->>FS: Decrement ticket inventory in /events
        Web->>PyFn: sendConfirmationEmail(registrationId)
        PyFn->>Email: Send ticket email with QR badge
        Email-->>Attendee: Delivers Confirmation Email
    else Paid Event - Manual Proof Upload
        Web->>PyFn: createAnonymousRegistration(orderData)
        PyFn->>FS: Create /registrations doc (paymentStatus: 'pending'), reserve ticket
        PyFn-->>Web: paymentLinkToken (single use, 24h expiry)
        Web-->>Attendee: Redirect to /payment/:registrationId?t=token
        Attendee->>Web: Transfers via bank/GCash offline
        Web->>Storage: Uploads proof screenshot
        Web->>PyFn: submitAnonymousPaymentProof(token, image, reference)
        PyFn->>FS: Create /paymentProofs doc (status: 'pending')
        PyFn->>FS: Set paymentStatus: 'processing', consume payment link token
        Note over Web,FS: Awaits Organizer Approval (see 5.2)
    end
```

---

### 5.2 Manual Payment Review Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Organizer
    participant Dashboard as Admin Dashboard
    participant PyFn as Cloud Functions
    participant FS as Firestore
    participant Email as Resend Email Service
    actor Attendee

    Organizer->>Dashboard: Reviews "Pending Payments" queue
    Dashboard->>FS: Fetch pending paymentProofs
    Organizer->>Dashboard: Inspects receipt image & reference ID
    Organizer->>Dashboard: Clicks "Approve Payment"
    Dashboard->>PyFn: processPaymentVerification(proofId, action: 'approved')
    PyFn->>FS: Update paymentProofs (verificationStatus: 'approved')
    PyFn->>FS: Update registrations (paymentStatus: 'paid', attendanceStatus: 'confirmed')
    PyFn->>Email: sendPaymentNotification(registrationId)
    Email-->>Attendee: Delivers Payment Confirmation & QR Ticket
```

---

### 5.3 On-Site QR Check-In Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee
    actor Staff as Organizer / Volunteer
    participant App as TeamApo Hub Scanner (/organizer/checkin)
    participant PyFn as Cloud Functions
    participant FS as Firestore

    Attendee->>Staff: Presents QR ticket on mobile or printout
    Staff->>App: Scans QR code using device camera (ZXing)
    App->>PyFn: checkInAttendee(scannedPayload)
    PyFn->>FS: Validate registration & eventId
    alt Already Checked-In
        PyFn-->>App: Warning: Already checked in at [Timestamp]
    else Valid Check-In
        PyFn->>FS: Update registration (attendanceStatus: 'checked-in', checkInTime: now)
        PyFn->>FS: Increment event_analytics.checkedIn
        PyFn->>FS: Log to activity_logs
        PyFn-->>App: Success! Attendee Name confirmed
    end
```

---

### 5.4 Feedback Submission & Dynamic Certificate Verification

```mermaid
sequenceDiagram
    autonumber
    actor Attendee
    participant Email as Attendee Email
    participant Web as TeamApo Hub Portal (/feedback/:eventId)
    participant PyFn as Cloud Functions
    participant FS as Firestore
    participant Storage as Cloud Storage
    participant Verify as Verification Portal (/verify/:code)

    Note over PyFn: Event concludes. Organizer triggers feedback blast.
    PyFn->>FS: Create /feedbackTokens for checked-in attendees
    PyFn->>Email: Send feedback request with secure token link
    Email->>Attendee: Opens link (apohub.gdgdavao.org/feedback/:id?token=XYZ)
    Attendee->>Web: Opens Feedback Page
    Web->>PyFn: resolveFeedbackToken(token)
    PyFn-->>Web: Returns Attendee Name & Email
    Attendee->>Web: Submits survey ratings & comments
    Web->>FS: Create /feedback document (immutable)
    Web->>Web: Renders Certificate via Canvas (jsPDF)
    Web->>Storage: Uploads rendered PDF to /certificates/{eventId}/
    Web->>FS: Create /certificates document (credentialId, verificationCode)
    Web->>FS: Update registration (feedbackSubmitted: true, certificateIssued: true)
    Web-->>Attendee: Displays Download Certificate Button & Verification Link
    
    Attendee->>Verify: Navigates to /verify/GDG-DVO-2026-XYZ
    Verify->>FS: Query /certificates where verificationCode == 'GDG-DVO-2026-XYZ'
    FS-->>Verify: Return recipient name, event title, issuance date
    Verify-->>Attendee: Renders Authenticated Green Badge
```

---

## 6. AI Subsystem Architecture

TeamApo Hub integrates the **Google GenAI SDK** (`@google/genai`) to power intelligent organizer workflows.

```mermaid
flowchart LR
    subgraph ClientWorkspace["Admin Social & Insights UI"]
        UI[Composer / Dashboard]
        Cache[(Local Storage Cache\nTTL: 1 Hour)]
    end
    
    subgraph AIService["src/services/aiService.ts"]
        KeyGen["Cache Key Generator\n(btoa hash)"]
        ClientSDK["GoogleGenAI Client"]
    end
    
    subgraph RemoteAI["Google AI Studio"]
        GeminiFlash["Gemini 2.5 / 1.5 Flash"]
    end

    UI -->|Prompt + Event Context| KeyGen
    KeyGen -->|Check Key| Cache
    Cache -->|Cache Hit| UI
    Cache -->|Cache Miss| ClientSDK
    ClientSDK -->|API Request| GeminiFlash
    GeminiFlash -->|Generated Text| ClientSDK
    ClientSDK -->|Store Result| Cache
    ClientSDK -->|Return Output| UI
```

### Key AI Features:
1. **Social Media Caption Composer**: Generates platform-tailored promotional copy for LinkedIn, Facebook, and X based on event speakers, topics, and date.
2. **Post-Event Sentiment Analysis**: Summarizes free-form attendee comments, aggregates top compliments, identifies logistics issues, and extracts requested future topics.
3. **Client-Side Deduplication Cache**: Implements an LRU-like 1-hour expiration cache in `localStorage` to prevent duplicate API requests and conserve quotas.

---

## 7. Deployment, Environments & Infrastructure

### 7.1 Multi-Environment Setup
| Parameter | Local Emulator Environment | Production Environment |
| :--- | :--- | :--- |
| **Frontend Host** | Vite Dev Server (`localhost:5173`) | Vercel Edge Network (`apohub.gdgdavao.org`) |
| **Auth** | Firebase Auth Emulator (`localhost:9099`) | Google Identity Toolkit |
| **Firestore** | Firestore Emulator (`localhost:8080`) | Cloud Firestore (`asia-southeast2`) |
| **Cloud Functions** | Functions Emulator (`localhost:5001`) | Cloud Functions v2 / Cloud Run (`asia-southeast2`) |
| **Storage** | Storage Emulator (`localhost:9199`) | Cloud Storage Bucket (`apohub-gdgdavao.appspot.com`) |

### 7.2 Build & Deployment Automation
The repository includes deployment scripts for all subsystems:

```bash
# Full local development stack (frontend + all emulators)
bun run dev:full

# Deploy Cloud Functions
bun run firebase:functions

# Deploy Firestore Security Rules & Indexes
bun run firebase:rules
bun run firebase:indexes

# Deploy Frontend to Vercel
vercel --prod
```
