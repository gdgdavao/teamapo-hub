# Security Rules Audit Notes

This file records the security assumptions behind the current prototype rules.
It is not a guarantee that a deployed application is secure.

## Public Data

- Published event documents and public certificate documents are intentionally
  readable without authentication.
- User profiles, registrations, payment proofs, feedback, notifications, and
  operational analytics are not public data.
- Payment-link access must be mediated by a callable function that verifies a
  short-lived token. Firestore rules cannot validate a URL query parameter.

## Required Trusted Operations

The following operations must run through Cloud Functions or another trusted
server boundary before production deployment:

- Registration creation and ticket inventory reservation
- Pricing and promo-code calculation
- Payment-proof submission and payment-link consumption
- Attendance check-in
- Certificate issuance

Client-side Firestore writes must not be used to set payment, attendance,
certificate, inventory, or authorization state.

## Attack Review

| Attack | Current prototype outcome | Required follow-up |
| --- | --- | --- |
| Anonymous client creates a paid or checked-in registration | Denied by registration validator | Keep privileged fields server-owned |
| Anonymous client overwrites event ticket definitions | Denied | Migrate reservation writes to a callable function |
| Anonymous client reads a registration by ID | Denied | Use token-verified payment resolver |
| Anonymous client mints a certificate | Denied | Keep issuance server-owned |
| Non-admin changes a user role | Denied | Preserve immutable role checks |
| Anonymous client reads payment proofs | Denied | Keep proof storage private |
| Arbitrary oversized public document | Limited by validator checks | Add emulator abuse tests for every public write |

## Release Blockers

- Revoke all service-account keys found in git history.
- Rotate any exposed email, payment, AI, deployment, or Firebase credentials.
- Rewrite history or publish a clean repository snapshot.
- Complete the callable-function migration and run emulator abuse tests.
