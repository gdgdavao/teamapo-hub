1. Introduction

The GDG Davao Event Hub is a centralized web application designed to streamline the entire event lifecycle for Google Developer Group (GDG) Davao. Currently, organizers rely on a fragmented set of tools (e.g., Google Forms, separate payment channels, manual email reminders, spreadsheet tracking) which is inefficient and creates a disjointed experience for attendees.
This platform will serve as a single source of truth for creating, managing, and promoting events. It aims to automate repetitive administrative tasks, enhance the attendee experience from registration to certificate issuance, and provide valuable data insights for continuous improvement. The project is inspired by the clean user interface of Luma and the ticketing/payment flow of platforms like HelixPay, but tailored specifically for the community's needs, such as manual payment verification.


2. Goals & Objectives

* For Organizers:
    * Reduce administrative overhead by at least 50% by automating registration, communication, and post-event workflows.
    * Centralize event management into a single, intuitive dashboard.
    * Improve data collection and analysis for better event planning.
* For Attendees:
    * Provide a seamless registration experience that is fast, mobile-friendly, and does not require creating an account.
    * Enhance communication with timely, automated event updates and reminders.
    * Deliver tangible value through easily accessible, verifiable digital certificates.


3. User Personas

* Alex (The Organizer): A volunteer core member at GDG Davao. Alex is tech-savvy but time-poor. They need a tool that allows them to quickly set up a new event, track registrations and payments in one place, and not have to worry about manually sending reminder emails or generating 100+ certificates after an event.
* Ben (The Attendee): A local student or professional interested in tech. Ben discovers GDG Davao events through social media. They want to sign up for an event on their phone in under two minutes without the friction of creating a new account. They value receiving a professional certificate to add to their portfolio.


4. Core Features & Requirements

This platform is divided into several key modules.

Module 1: Event Creation & Management (Admin Dashboard)

Organizers need a powerful and simple interface to manage all aspects of their events.
* Comprehensive Event Setup: A form to create events with the following fields:
    * Core Details: Event Title, Description (with rich text support), Date, Start & End Time, Timezone.
    * Venue: Location type (Online, Offline, Hybrid).
        * Online: Field for a meeting link (e.g., Google Meet, Zoom).
        * Offline: Field for a physical address and an embedded Google Maps view.
    * Speaker Profiles: Ability to add multiple speakers with Name, Photo, Title/Company, and a short Bio.
    * Ticketing: Create multiple ticket types (e.g., "Early Bird," "Student," "Regular"). Each ticket can be Free or Paid, with a specific price and quantity limit.
* Registration Management:
    * Set a global registration cap and a deadline for each event.
    * Customizable Registration Form: A simple interface for organizers to add, remove, or reorder fields (e.g., "T-shirt Size," "Dietary Restrictions," "Company Name") required for a specific event. Default fields will be Name and Email.
* Admin Dashboard: A centralized view showing all events with their status (Draft, Published, Archived). Key real-time stats like Registered Attendees, Tickets Sold, and Check-in Rate will be visible at a glance.
* Event Lifecycle Management: Organizers can perform the following actions, which will trigger automated email notifications to registered attendees:
    * Publish: Make the event live on the public discovery page.
    * Unpublish: Hide the event from the public page.
    * Postpone: Change the event date and notify attendees.
    * Archive: Move completed events to an archive section.


Module 3: Payment Gateway (Manual Verification)

To avoid transaction fees and leverage common local payment methods, payment verification will be manual.
* Payment Instructions: After selecting a paid ticket, the user is shown a screen with GDG Davao's payment details:
    * GCash QR Code
    * Maya QR Code
    * Bank Account Details (Bank Name, Account Number, Account Name)
* Proof of Payment Upload: The user must upload a screenshot of their transaction and enter the Transaction Reference ID.
* Manual Approval: In the admin dashboard, organizers will see a "Pending Payments" queue. They can view the uploaded screenshot and reference ID to Approve or Reject the payment. The attendee's registration status is updated accordingly, and an email notification is sent.

Module 4: Notification System (Email)

Automated email workflows are critical for reducing manual work and keeping attendees informed.
* Registration Confirmation: Instantly sent after registration, containing event details, a calendar invite, and a unique QR code for check-in.
* Payment Confirmation: Sent once an organizer manually approves a payment.
* Event Reminders: Automatically sent 24 hours and 1 hour before the event starts.
* Post-Event Follow-up: Automatically sent to checked-in attendees, requesting feedback.
* Certificate Notification: Sent after an attendee submits feedback, containing a link to their digital certificate.
* Custom Broadcasts: Organizers can write and send custom email updates to all attendees of a specific event (e.g., for last-minute changes).

Module 5: Feedback Collection & Certificate Generation

This module closes the event loop and provides value to both organizers and attendees.
* Smart Feedback Triggers: The feedback request email is automatically sent only to attendees whose QR codes were successfully scanned at the event.
* Flexible Feedback Forms: Similar to the registration form, organizers can customize the feedback form for each event with various question types (rating scales, multiple choice, open-ended).
* Automated Certificate Generation: Upon successful submission of the feedback form, a PDF certificate is dynamically generated.
    * Professional Templates: A selection of pre-designed templates with GDG branding (e.g., for workshops, seminars, speakers).
    * Dynamic Data: The certificate is populated with the attendee's name, event title, and date.
    * Unique Credential ID: Each certificate is assigned a unique, non-sequential ID (e.g., GDG-DVO-EVT101-ATT56).
* Digital Verification Portal: A public page (events.gdgdavao.com/verify) where anyone can enter a Credential ID to validate a certificate's authenticity. The page will display the attendee's name, event title, and date of issuance.

Module 6: Attendance Tracking

A modern, QR-code-based system to accurately track attendance.
* QR Code Check-in: The organizer or a volunteer accesses a secure check-in page on their phone or tablet. Using the device's camera, they can scan the QR code from the attendee's confirmation email (on their phone or a printout).
* Real-time Analytics: The admin dashboard will show a live count of checked-in attendees during the event.
* Automated Triggers: A successful check-in changes the attendee's status from "Registered" to "Checked-in," which in turn enables the post-event feedback and certificate workflow for that user.


1. Technical Stack & Architecture

* Styling: TailwindCSS (for rapid, utility-first UI development that can easily adhere to a design system).
* Backend & Database: Firebase
    * Firestore: NoSQL database for storing event data, registrations, feedback, etc.
    * Firebase Authentication: For securing the admin dashboard for organizers.
    * Cloud Storage for Firebase: To store user-uploaded payment proofs and generated PDF certificates.
    * Cloud Functions for Firebase: To run backend logic for sending automated emails and generating certificates.


6. Design & UI/UX Principles

* Branding: The UI will strictly adhere to Google's branding guidelines, using the official Google color palette (blue, red, yellow, green) and fonts (e.g., Google Sans, Roboto).
* Familiarity & Intuitiveness: The UI/UX will leverage common design patterns seen in modern web applications to ensure it is immediately familiar and easy to use. The layout will be clean, with a strong visual hierarchy and clear calls-to-action.
* Responsiveness: The application will be fully responsive, providing an optimal experience on phones, tablets, and desktops. A mobile-first approach will be prioritized.


7. Success Metrics

* Adoption Rate: Number of events created and managed exclusively through the platform.
* Organizer Efficiency: Time saved per event on administrative tasks (measured via surveys with the core team).
* Attendee Satisfaction: CSAT/NPS score for the registration and post-event experience, collected via the feedback forms.
* Feedback Submission Rate: Percentage of checked-in attendees who complete the feedback form.
* Certificate Verification Usage: Number of monthly hits on the public verification portal.