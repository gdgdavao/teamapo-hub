import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TEMPLATES_DIR = join(ROOT, 'functions', 'email_templates');
const LOADER_FILE = join(ROOT, 'functions', 'email_template_loader.py');
const EMAIL_SERVICE_FILE = join(ROOT, 'functions', 'email_service.py');

const HEADER_IMAGE_URL = 'https://assets.gdgdavao.org/email-assets/gdgdvo-header-mail.png';
const OLD_HEADER_IMAGES = [
  'apohub-title.png',
  'teamapo-hub-header-mail.png',
  '/header-mail.png'
];

const TEMPLATE_FILES = [
  'base_template.html',
  'base_template_with_embedded_logo.html',
  'footer.html',
  'registration_confirmation.html',
  'payment_notification.html',
  'certificate_notification.html',
  'event_reminder.html',
  'feedback_request.html'
];

describe('Email Templates Design System & Architecture', () => {
  it('base templates exist and use the new header image', () => {
    const baseFiles = ['base_template.html', 'base_template_with_embedded_logo.html'];

    for (const file of baseFiles) {
      const filePath = join(TEMPLATES_DIR, file);
      expect(existsSync(filePath), `${file} should exist`).toBe(true);

      const content = readFileSync(filePath, 'utf8');
      expect(content).toContain(HEADER_IMAGE_URL);
      for (const oldImage of OLD_HEADER_IMAGES) {
        expect(content).not.toContain(oldImage);
      }
      expect(content).toMatch(/width:\s*235px/);
      expect(content).toMatch(/max-width:\s*100%/);
      expect(content).toContain('align="center"');
      expect(content).toMatch(/text-align:\s*center/);
    }
  });

  it('base templates include the signature Google 4-color accent bar', () => {
    const baseContent = readFileSync(join(TEMPLATES_DIR, 'base_template.html'), 'utf8');
    expect(baseContent).toContain('#4285f4'); // Google Blue
    expect(baseContent).toContain('#ea4335'); // Google Red
    expect(baseContent).toContain('#fbbc04'); // Google Yellow
    expect(baseContent).toContain('#34a853'); // Google Green
  });

  it('email templates do not contain emojis', () => {
    for (const file of TEMPLATE_FILES) {
      const filePath = join(TEMPLATES_DIR, file);
      const content = readFileSync(filePath, 'utf8');
      for (const char of content) {
        const cp = char.codePointAt(0) ?? 0;
        expect(cp < 0x1F000, `Found emoji "${char}" in ${file}`).toBe(true);
      }
    }
  });

  it('email templates do not use forbidden linear gradients', () => {
    for (const file of TEMPLATE_FILES) {
      const filePath = join(TEMPLATES_DIR, file);
      const content = readFileSync(filePath, 'utf8');
      expect(content).not.toContain('linear-gradient');
      expect(content).not.toContain('#667eea');
      expect(content).not.toContain('#764ba2');
    }
  });

  it('certificate and feedback call-to-action buttons use Google Material 3 pill button tokens', () => {
    const certContent = readFileSync(join(TEMPLATES_DIR, 'certificate_notification.html'), 'utf8');
    const feedbackContent = readFileSync(join(TEMPLATES_DIR, 'feedback_request.html'), 'utf8');

    // Google M3 pill button: #0b57d0 (6.39:1 AA contrast with white text) and 24px radius
    expect(certContent).toContain('#0b57d0');
    expect(certContent).toContain('border-radius: 24px');
    expect(certContent).toContain('color: #ffffff');

    expect(feedbackContent).toContain('#0b57d0');
    expect(feedbackContent).toContain('border-radius: 24px');
    expect(feedbackContent).toContain('color: #ffffff');
  });

  it('email_service.py renders location map call-to-action button using Google Material 3 pill tokens', () => {
    const serviceContent = readFileSync(EMAIL_SERVICE_FILE, 'utf8');
    expect(serviceContent).toContain('View Location on Map');
    expect(serviceContent).toContain('#0b57d0');
    expect(serviceContent).toContain('border-radius: 24px');
    expect(serviceContent).toContain('color: #ffffff');
  });

  it('greeting is professional without emojis and aligns with Google Sans hierarchy', () => {
    const baseContent = readFileSync(join(TEMPLATES_DIR, 'base_template.html'), 'utf8');
    expect(baseContent).not.toContain('Nimbus Mono');
    expect(baseContent).not.toContain('Cutive Mono');
    expect(baseContent).toContain('Hi {{user_name}},');
    expect(baseContent).not.toContain('👋');
    expect(baseContent).toContain("'Google Sans', Roboto");
  });

  it('email_template_loader.py uses verified Google M3 container status tokens', () => {
    const loaderContent = readFileSync(LOADER_FILE, 'utf8');
    // Approved (Google Green): #e6f4ea / #137333 / #ceead6
    expect(loaderContent).toContain('#e6f4ea');
    expect(loaderContent).toContain('#137333');
    expect(loaderContent).toContain('#ceead6');

    // Rejected (Google Red): #fce8e6 / #c5221f / #fad2cf
    expect(loaderContent).toContain('#fce8e6');
    expect(loaderContent).toContain('#c5221f');
    expect(loaderContent).toContain('#fad2cf');

    // Pending (Google Amber): #fef7e0 / #b06000 / #feefc3
    expect(loaderContent).toContain('#fef7e0');
    expect(loaderContent).toContain('#b06000');
    expect(loaderContent).toContain('#feefc3');
  });

  it('email_service.py renders QR code and payment instructions using Google M3 tokens', () => {
    const serviceContent = readFileSync(EMAIL_SERVICE_FILE, 'utf8');
    expect(serviceContent).toContain('#f8fafd');
    expect(serviceContent).toContain('#dadce0');
    expect(serviceContent).toContain('#e8f0fe');
    expect(serviceContent).toContain('#1a73e8');
  });

  it('email_service.py supports Mailpit SMTP dev mode dispatch', () => {
    const serviceContent = readFileSync(EMAIL_SERVICE_FILE, 'utf8');
    expect(serviceContent).toContain('use_mailpit');
    expect(serviceContent).toContain('_send_via_smtp');
    expect(serviceContent).toContain('mailpit_host');
    expect(serviceContent).toContain('mailpit_port');
    expect(serviceContent).toContain('smtplib.SMTP');
  });

  it('cross-client email compatibility headers and defensive light mode meta tags are present', () => {
    const baseContent = readFileSync(join(TEMPLATES_DIR, 'base_template.html'), 'utf8');
    expect(baseContent).toContain('meta name="color-scheme" content="light"');
    expect(baseContent).toContain('meta name="supported-color-schemes" content="light"');
    expect(baseContent).toContain('meta name="viewport" content="width=device-width, initial-scale=1.0"');
    expect(baseContent).toContain('mso-table-lspace');
    expect(baseContent).toContain('role="presentation"');
    expect(baseContent).toContain('[if (gte mso 9)|(IE)]');
  });

  it('all required placeholders are maintained across templates', () => {
    const registration = readFileSync(join(TEMPLATES_DIR, 'registration_confirmation.html'), 'utf8');
    expect(registration).toContain('{{event_title}}');
    expect(registration).toContain('{{event_date}}');
    expect(registration).toContain('{{event_location}}');
    expect(registration).toContain('{{maps_button}}');
    expect(registration).toContain('{{registration_status_title}}');
    expect(registration).toContain('{{registration_status_message}}');
    expect(registration).toContain('{{next_steps_items}}');
    expect(registration).toContain('{{closing_message}}');

    const payment = readFileSync(join(TEMPLATES_DIR, 'payment_notification.html'), 'utf8');
    expect(payment).toContain('{{intro_paragraph}}');
    expect(payment).toContain('{{status_bg_color}}');
    expect(payment).toContain('{{status_border_color}}');
    expect(payment).toContain('{{status_text_color}}');
    expect(payment).toContain('{{status_message}}');
    expect(payment).toContain('{{registration_id}}');
    expect(payment).toContain('{{payment_instructions_section}}');
    expect(payment).toContain('{{qr_code_section}}');
    expect(payment).toContain('{{next_steps}}');
    expect(payment).toContain('{{contact_prompt}}');

    const certificate = readFileSync(join(TEMPLATES_DIR, 'certificate_notification.html'), 'utf8');
    expect(certificate).toContain('{{event_title}}');
    expect(certificate).toContain('{{certificate_url}}');

    const reminder = readFileSync(join(TEMPLATES_DIR, 'event_reminder.html'), 'utf8');
    expect(reminder).toContain('{{event_title}}');
    expect(reminder).toContain('{{time_text}}');
    expect(reminder).toContain('{{event_date}}');
    expect(reminder).toContain('{{event_location}}');
    expect(reminder).toContain('{{maps_button}}');

    const feedback = readFileSync(join(TEMPLATES_DIR, 'feedback_request.html'), 'utf8');
    expect(feedback).toContain('{{event_title}}');
    expect(feedback).toContain('{{feedback_url}}');

    const footer = readFileSync(join(TEMPLATES_DIR, 'footer.html'), 'utf8');
    expect(footer).toContain('{{footer_message}}');
  });

  it('footer contains updated GDG Davao disclaimer and centered copyright notice', () => {
    const footer = readFileSync(join(TEMPLATES_DIR, 'footer.html'), 'utf8');
    expect(footer).toContain('Google Developer Groups - Davao (GDG-Davao) is an independent community; activities and opinions expressed here should in no way be linked to Google, the corporation.');
    expect(footer).toContain('text-align: center;');
    expect(footer).toContain('&copy; 2026 Google Developer Groups Davao &bull; TeamApo Hub');
  });

  it('email templates and service use the Googleyness, Google Developer Groups - Davao sign-off', () => {
    const templatesWithSignoff = [
      'registration_confirmation.html',
      'payment_notification.html',
      'certificate_notification.html',
      'event_reminder.html',
      'feedback_request.html'
    ];

    for (const file of templatesWithSignoff) {
      const content = readFileSync(join(TEMPLATES_DIR, file), 'utf8');
      expect(content).toContain('Googleyness,<br />');
      expect(content).toContain('Google Developer Groups - Davao');
      expect(content).not.toContain('Best regards');
    }

    const serviceContent = readFileSync(EMAIL_SERVICE_FILE, 'utf8');
    expect(serviceContent).toContain('Googleyness,\nGoogle Developer Groups - Davao');
    expect(serviceContent).not.toContain('Best regards,\nThe GDG Davao Team');
  });

  it('email_template_loader.py and email_service.py use Registration Approved and discontinue pending payment emails', () => {
    const loaderContent = readFileSync(LOADER_FILE, 'utf8');
    const serviceContent = readFileSync(EMAIL_SERVICE_FILE, 'utf8');

    // Loader uses 'Registration Approved!'
    expect(loaderContent).toContain("'approved': 'Registration Approved!'");
    expect(loaderContent).not.toContain("'approved': 'Payment Approved!'");
    expect(loaderContent).not.toContain('Payment Approved');

    // Service uses 'Registration Approved' and no 'Payment Approved'
    expect(serviceContent).toContain("'approved': 'Registration Approved'");
    expect(serviceContent).not.toContain('Payment Approved');

    // Service short-circuits pending payments
    expect(serviceContent).toContain("if status == 'pending':");
    expect(serviceContent).toContain("'skipped': True");
    expect(serviceContent).toContain('Pending payment emails are discontinued');
  });
});

