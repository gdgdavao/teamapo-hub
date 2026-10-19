import { describe, it, expect } from 'vitest';
import {
  isCrawlerUserAgent,
  escapeHtml,
  buildEventMetaDescription,
  buildEventHtmlWithMeta,
  parseFirestoreDocument,
  DEFAULT_OG_IMAGE,
  DEFAULT_SITE_URL,
  EventMetadata,
} from '@/utils/openGraph';

describe('OpenGraph & Social Media Sharing Contract', () => {
  describe('Crawler User-Agent Detection (isCrawlerUserAgent)', () => {
    it('accurately identifies major social media crawlers and bots', () => {
      const crawlers = [
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'facebookcatalog/1.0',
        'Facebot',
        'Twitterbot/1.0',
        'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
        'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'TelegramBot (like TwitterBot)',
        'WhatsApp/2.21.12.21 A',
        'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
        'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Pinterest/0.2 (+http://www.pinterest.com/bot.html)',
        'SkypeUriPreview Preview/0.5',
      ];

      crawlers.forEach((ua) => {
        expect(isCrawlerUserAgent(ua), `Expected '${ua}' to be detected as crawler`).toBe(true);
      });
    });

    it('does NOT flag standard web browsers as crawlers', () => {
      const browsers = [
        // Safari (macOS & iOS)
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        // Chrome (macOS, Windows, Android)
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        // Firefox
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      ];

      browsers.forEach((ua) => {
        expect(isCrawlerUserAgent(ua), `Expected browser '${ua}' NOT to be flagged as crawler`).toBe(false);
      });
    });

    it('returns false for empty, null, or undefined User-Agent', () => {
      expect(isCrawlerUserAgent('')).toBe(false);
      expect(isCrawlerUserAgent(null)).toBe(false);
      expect(isCrawlerUserAgent(undefined)).toBe(false);
    });
  });

  describe('HTML Escaping & XSS Prevention', () => {
    it('escapes dangerous HTML characters', () => {
      const raw = 'AI & "Tech" <Summit> \'2026\'';
      const escaped = escapeHtml(raw);
      expect(escaped).toBe('AI &amp; &quot;Tech&quot; &lt;Summit&gt; &#39;2026&#39;');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).not.toContain('"');
    });
  });

  describe('Event Meta Description Building', () => {
    it('builds concise composite description with date and venue', () => {
      const event: EventMetadata = {
        id: 'event-1',
        title: 'GDG Davao AI Hackathon',
        description: 'Join the premier developer competition in Region XI.',
        startDate: '2026-11-14T09:00:00Z',
        venue: {
          type: 'physical',
          name: 'Finster Hall, Ateneo de Davao',
          city: 'Davao City',
        },
      };

      const desc = buildEventMetaDescription(event);
      expect(desc).toContain('Join the premier developer competition in Region XI.');
      expect(desc).toContain('2026');
      expect(desc).toContain('Finster Hall, Ateneo de Davao');
    });

    it('handles online events with Online Event label', () => {
      const event: EventMetadata = {
        id: 'event-2',
        title: 'Virtual Cloud Study Jam',
        shortDescription: 'Deep dive into Vertex AI and Gemini APIs.',
        venue: {
          type: 'online',
        },
      };

      const desc = buildEventMetaDescription(event);
      expect(desc).toContain('Deep dive into Vertex AI and Gemini APIs.');
      expect(desc).toContain('Online Event');
    });
  });

  describe('HTML OpenGraph & Twitter Card Injection (buildEventHtmlWithMeta)', () => {
    const SAMPLE_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>TeamApo Hub</title>
    <meta name="description" content="Default platform description" />
    <meta property="og:title" content="Default OG Title" />
    <meta property="og:image" content="https://example.com/default.png" />
    <meta name="twitter:card" content="summary" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    it('injects event-specific OpenGraph, Twitter Card, and Schema.org structured data', () => {
      const event: EventMetadata = {
        id: 'devfest-2026',
        slug: 'devfest-2026',
        title: 'DevFest Davao 2026',
        shortDescription: 'Annual developer festival celebrating Google technologies in Mindanao.',
        imageUrl: 'https://storage.googleapis.com/apohub-bucket/events/devfest-cover.jpg',
        startDate: '2026-10-24T08:00:00Z',
        endDate: '2026-10-24T18:00:00Z',
        venue: {
          type: 'physical',
          name: 'SMX Convention Center Davao',
          city: 'Davao City',
        },
      };

      const html = buildEventHtmlWithMeta(SAMPLE_TEMPLATE, event, DEFAULT_SITE_URL);

      // Title
      expect(html).toContain('<title>DevFest Davao 2026 | Google Developer Groups - Davao</title>');

      // OpenGraph tags
      expect(html).toContain('<meta property="og:type" content="event" />');
      expect(html).toContain('<meta property="og:title" content="DevFest Davao 2026 | Google Developer Groups - Davao" />');
      expect(html).toContain('<meta property="og:image" content="https://storage.googleapis.com/apohub-bucket/events/devfest-cover.jpg" />');
      expect(html).toContain('<meta property="og:image:secure_url" content="https://storage.googleapis.com/apohub-bucket/events/devfest-cover.jpg" />');
      expect(html).toContain('<meta property="og:image:width" content="1200" />');
      expect(html).toContain('<meta property="og:image:height" content="630" />');
      expect(html).toContain('<meta property="og:url" content="https://apohub.gdgdavao.org/e/devfest-2026" />');
      expect(html).toContain('<meta property="og:site_name" content="Google Developer Groups - Davao" />');

      // Twitter Card tags
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(html).toContain('<meta name="twitter:title" content="DevFest Davao 2026 | Google Developer Groups - Davao" />');
      expect(html).toContain('<meta name="twitter:image" content="https://storage.googleapis.com/apohub-bucket/events/devfest-cover.jpg" />');

      // Canonical link
      expect(html).toContain('<link rel="canonical" href="https://apohub.gdgdavao.org/e/devfest-2026" />');

      // Schema.org JSON-LD
      expect(html).toContain('application/ld+json');
      expect(html).toContain('"@type": "Event"');
      expect(html).toContain('"name": "DevFest Davao 2026"');
      expect(html).toContain('SMX Convention Center Davao');

      // Old default tags removed
      expect(html).not.toContain('Default OG Title');
      expect(html).not.toContain('https://example.com/default.png');
    });

    it('falls back to default GDG Davao banner if event has no custom image', () => {
      const event: EventMetadata = {
        id: 'no-image-event',
        slug: 'no-image-event',
        title: 'Community Meetup',
      };

      const html = buildEventHtmlWithMeta(SAMPLE_TEMPLATE, event, DEFAULT_SITE_URL);
      expect(html).toContain(`content="${DEFAULT_OG_IMAGE}"`);
    });

    it('correctly handles ID-based URL when event has no custom slug', () => {
      const event: EventMetadata = {
        id: 'evt-999',
        title: 'Spontaneous Workshop',
      };

      const html = buildEventHtmlWithMeta(SAMPLE_TEMPLATE, event, DEFAULT_SITE_URL);
      expect(html).toContain('https://apohub.gdgdavao.org/events/evt-999/register');
    });
  });

  describe('Firestore REST API Document Unpacking (parseFirestoreDocument)', () => {
    it('unpacks strings, booleans, numbers, timestamps, maps, and arrays', () => {
      const rawDoc = {
        fields: {
          title: { stringValue: 'GDG Build With AI' },
          isPublished: { booleanValue: true },
          capacity: { integerValue: '250' },
          price: { doubleValue: 150.5 },
          tags: {
            arrayValue: {
              values: [
                { stringValue: 'AI' },
                { stringValue: 'Cloud' },
              ],
            },
          },
          venue: {
            mapValue: {
              fields: {
                name: { stringValue: 'Davao Hub' },
                city: { stringValue: 'Davao City' },
              },
            },
          },
        },
      };

      const unpacked = parseFirestoreDocument(rawDoc);
      expect(unpacked.title).toBe('GDG Build With AI');
      expect(unpacked.isPublished).toBe(true);
      expect(unpacked.capacity).toBe(250);
      expect(unpacked.price).toBe(150.5);
      expect(unpacked.tags).toEqual(['AI', 'Cloud']);
      expect(unpacked.venue).toEqual({ name: 'Davao Hub', city: 'Davao City' });
    });
  });
});
