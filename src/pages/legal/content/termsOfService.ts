import { LegalDocument } from './privacyPolicy';

export const TERMS_OF_SERVICE: LegalDocument = {
  id: 'terms',
  title: 'Terms of Service',
  lastUpdated: 'October 16, 2026',
  version: '1.0',
  sections: [
    {
      id: 'acceptance-of-terms',
      title: '1. Acceptance of Terms',
      summary: 'Binding agreement upon accessing, registering for events, or operating TeamApo Hub.',
      content: [
        'By accessing, browsing, registering for events, or otherwise using the TeamApo Hub platform ("Service"), available at https://apohub.gdgdavao.org, You agree to be bound by these Terms of Service ("Terms") and all applicable laws and regulations of the Republic of the Philippines.',
        'If You do not agree with any of these Terms, You are prohibited from using or accessing this Service.',
        'These Terms constitute a legally binding agreement between You ("User", "Attendee", "Organizer") and TeamApo Hub / Google Developer Groups (GDG) Davao ("Company", "We", "Us", "Our").'
      ]
    },
    {
      id: 'description-of-service',
      title: '2. Description of the Service',
      summary: 'Platform purpose, event discovery, ticketing, attendance check-in, and digital certification.',
      content: [
        'TeamApo Hub is an open-source, community-engineered event lifecycle management platform designed for GDG Davao and technology community events in Region XI and the Philippines.',
        'The Service provides:',
        '• Public event discovery and registration pages (e.g., https://apohub.gdgdavao.org/e/:slug).',
        '• QR-code enabled attendee ticket generation and digital delivery.',
        '• Registration fee tracking and payment proof submission (GCash, Maya, Bank Transfer).',
        '• Real-time venue check-in verification via optical camera scanners.',
        '• Automated post-event feedback surveys and cryptographic digital certificate generation with public verification at /verify/:code.',
        '• Administrative and organizer workspaces with granular role-based and attribute-based access controls.'
      ]
    },
    {
      id: 'user-roles-and-accounts',
      title: '3. User Roles & Accounts',
      summary: 'Anonymous attendee privacy model, organizer onboarding, and account responsibilities.',
      content: [
        'Attendee Model: In accordance with our privacy-first philosophy, event attendees are not required to create a Firebase Authentication account to register for public events. Sensitive attendee interactions (such as submitting feedback or uploading payment proofs) use secure, single-purpose access tokens.',
        'Organizers & Administrators: Event organizers and platform administrators receive authenticated credentials created by an administrator or through authorized Google Single Sign-On (SSO). Accounts are personal, non-transferable, and restricted to pre-authorized community volunteers.',
        'Account Security: Authenticated users are responsible for maintaining the confidentiality of their credentials and immediately notifying support@gdgdavao.org of any unauthorized access.'
      ]
    },
    {
      id: 'event-registration-and-ticketing',
      title: '4. Event Registration & Ticketing Invariants',
      summary: 'Single ticket per person invariant, transfer restrictions, and venue capacity limits.',
      content: [
        'Single Ticket Per Person: To ensure fair access for the developer community, each attendee is limited to exactly one (1) confirmed registration per event. Duplicate registrations using identical email addresses are automatically rejected by the platform.',
        'Non-Transferability: Unless explicitly permitted in writing by event organizers, tickets and QR entry badges are issued to specific individuals and cannot be transferred, resold, or bartered.',
        'Capacity & Registration Windows: Event registrations are subject to strict venue fire safety and hall capacity limits. Organizers reserve the right to close registrations early once maximum capacity is reached or waitlist thresholds are exceeded.',
        'QR Code Presentation: Attendees must present their issued digital or printed QR ticket upon entry. Forged, duplicate, or tampered QR codes will result in refusal of venue admission.'
      ]
    },
    {
      id: 'payments-and-refund-policy',
      title: '5. Payments, Fees & Verification Policy',
      summary: 'Community registration fees, manual payment verification queue, and refund conditions.',
      content: [
        'Community Registration Fees: When an event requires a registration fee (e.g., to cover venue catering, swag kits, or workshop materials), fees are quoted in Philippine Pesos (PHP).',
        'Manual Verification Queue: Payments made via digital payment channels (such as GCash or Maya) require uploading an authentic transaction receipt screenshot or reference code. A registration remains provisional ("Pending Verification") until verified by an authorized event organizer.',
        'Refund Policy: Because event logistics, venue deposits, catering counts, and custom attendee swag are committed in advance, community event fees are non-refundable unless an event is permanently cancelled by the organizers.',
        'Fraudulent Payment Submissions: Submitting falsified, reused, or manipulated payment receipts constitutes grounds for immediate disqualification, cancellation of tickets, and blacklisting from future GDG Davao community events.'
      ]
    },
    {
      id: 'code-of-conduct-and-acceptable-use',
      title: '6. Code of Conduct & Acceptable Use',
      summary: 'Harassment-free community standards and platform operational integrity rules.',
      content: [
        'GDG Community Guidelines: All attendees, speakers, sponsors, and organizers are required to abide by the Google Developer Groups Community Guidelines. We are dedicated to providing a harassment-free event experience for everyone, regardless of gender, sexual orientation, disability, physical appearance, body size, race, or religion.',
        'Venue Safety & Respect: Disruptive behavior, weapons, intoxication, or unauthorized commercial solicitation at event venues is strictly prohibited.',
        'Platform Integrity: You agree not to: (a) attempt unauthorized access to restricted collections or Cloud Functions; (b) reverse engineer or extract API keys; (c) deploy automated crawlers or scrapers that overwhelm server infrastructure; (d) submit false or defamatory event feedback.'
      ]
    },
    {
      id: 'digital-certificates-and-verification',
      title: '7. Digital Certificates & Verification',
      summary: 'Conditions for earning, displaying, and verifying official certificates of attendance.',
      content: [
        'Issuance Criteria: Certificates of Completion or Attendance are issued only to attendees who have officially checked in at the event venue and completed the mandatory post-event feedback survey.',
        'Public Verification: Each certificate carries a unique cryptographic identifier verifiable publicly at https://apohub.gdgdavao.org/verify/:code.',
        'Revocation Rights: GDG Davao reserves the right to revoke, invalidate, or flag any certificate found to have been obtained through fraudulent check-in, identity misrepresentation, or policy violations.'
      ]
    },
    {
      id: 'intellectual-property-and-open-source',
      title: '8. Intellectual Property & Open-Source Software',
      summary: 'Platform codebase licensing, community branding, and presentation content rights.',
      content: [
        'Open-Source Codebase: TeamApo Hub source code is licensed under the MIT License as an open-source project for the global Google Developer Groups community.',
        'Trademarks: "TeamApo Hub", "GDG Davao", and related logos are trademarks of GDG Davao. "Google" and the Google Developer Groups logo are trademarks of Google LLC.',
        'Speaker & Presentation Content: Presentation slides, recorded technical sessions, and speaker materials remain the intellectual property of their respective creators.'
      ]
    },
    {
      id: 'privacy-and-data-protection',
      title: '9. Privacy & DPA 2012 Compliance',
      summary: 'Data protection commitment under Philippine law and cross-reference to Privacy Policy.',
      content: [
        'Your use of the Service is also governed by our Privacy Policy (https://apohub.gdgdavao.org/privacy), which details our data handling practices under the Republic Act No. 10173 (Philippines Data Privacy Act of 2012).',
        'By using the Service, You acknowledge that event organizers will receive registration details necessary to plan and conduct the specific event You register for.'
      ]
    },
    {
      id: 'disclaimers-and-limitation-of-liability',
      title: '10. Disclaimers, Force Majeure & Limitation of Liability',
      summary: 'Weather, power, and venue disruption provisions for tropical event resilience.',
      content: [
        'Service Provided "As Is": The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied.',
        'Force Majeure & Event Rescheduling: GDG Davao is not liable for delays, venue alterations, or event cancellations caused by circumstances beyond reasonable control, including but not limited to typhoons, earthquakes, regional power grid outages, internet disruptions, or public health emergencies.',
        'Limitation of Liability: In no event shall TeamApo Hub, GDG Davao, its volunteer organizers, or sponsors be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use the Service.'
      ]
    },
    {
      id: 'governing-law-and-dispute-resolution',
      title: '11. Governing Law & Jurisdiction',
      summary: 'Legal jurisdiction governed by the laws of the Republic of the Philippines.',
      content: [
        'These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without regard to its conflict of law provisions.',
        'Any legal action, suit, or proceeding arising out of or related to these Terms or the Service shall be instituted exclusively in the competent courts of Davao City, Philippines.'
      ]
    },
    {
      id: 'modifications-and-contact',
      title: '12. Modifications to Terms & Contact Support',
      summary: 'Right to update terms and official communication channels.',
      content: [
        'We reserve the right to modify or replace these Terms at any time. When material changes occur, we will update the "Last updated" date at the top of this document.',
        'If You have any questions or concerns regarding these Terms of Service, please contact us:',
        '• By email: support@gdgdavao.org',
        '• Official Community: Google Developer Groups (GDG) Davao, Philippines',
        '• Official Website: https://gdgdavao.org'
      ]
    }
  ]
};
