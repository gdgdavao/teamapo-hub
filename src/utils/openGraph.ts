/**
 * OpenGraph & Social Media Meta Tag Utilities for TeamApo Hub
 * Generates standards-compliant OpenGraph (Facebook, LinkedIn, Discord),
 * Twitter Cards (X), and Schema.org JSON-LD structured data for public event sharing.
 *
 * Caters across all crawlers and browsers: WebKit/Safari, Chrome, Firefox.
 */

export interface EventMetadata {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  bannerUrl?: string;
  startDate?: string | Date | { seconds?: number };
  endDate?: string | Date | { seconds?: number };
  venue?: {
    type?: string;
    name?: string;
    city?: string;
    address?: string;
    onlineDetails?: {
      meetingUrl?: string;
    };
  };
  organizer?: {
    name?: string;
    email?: string;
  };
  status?: string;
  isPublished?: boolean;
}

export const DEFAULT_OG_IMAGE = 'https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png';
export const DEFAULT_SITE_URL = 'https://apohub.gdgdavao.org';
export const DEFAULT_SITE_NAME = 'TeamApo Hub';

export const CRAWLER_USER_AGENTS_REGEX =
  /(facebookexternalhit|facebookcatalog|facebookplatform|facebot|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|slackbot|applebot|googlebot|pinterest|bitlybot|skypeuripreview|meta-externalagent|vkshare|quora link preview|w3c_validator)/i;

/**
 * Checks if incoming User-Agent matches known social media link preview bots and search engine crawlers.
 */
export function isCrawlerUserAgent(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS_REGEX.test(userAgent);
}

/**
 * Escapes characters for HTML attribute and content injection to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parses raw Firestore REST API document format into standard JavaScript object.
 */
export function parseFirestoreDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const fields = (doc?.fields as Record<string, unknown>) || {};
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(fields)) {
    const v = val as Record<string, unknown>;
    if ('stringValue' in v) {
      result[key] = v.stringValue;
    } else if ('booleanValue' in v) {
      result[key] = v.booleanValue;
    } else if ('integerValue' in v) {
      result[key] = Number(v.integerValue);
    } else if ('doubleValue' in v) {
      result[key] = Number(v.doubleValue);
    } else if ('timestampValue' in v) {
      result[key] = new Date(v.timestampValue as string);
    } else if ('mapValue' in v) {
      result[key] = parseFirestoreDocument(v.mapValue as Record<string, unknown>);
    } else if ('arrayValue' in v) {
      const arr = (v.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
      result[key] = arr.map((item) => {
        if ('stringValue' in item) return item.stringValue;
        if ('mapValue' in item) return parseFirestoreDocument(item.mapValue as Record<string, unknown>);
        return item;
      });
    }
  }

  return result;
}

/**
 * Parses date input into standard Date object.
 */
function parseDate(input?: string | Date | { seconds?: number }): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'object' && typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }
  if (typeof input === 'string') {
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Formats a Date into a human-readable date string.
 */
export function formatDisplayDate(date: Date | null): string | null {
  if (!date) return null;
  try {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Builds composite meta description including date and venue info.
 */
export function buildEventMetaDescription(event: EventMetadata): string {
  const baseDescription =
    event.shortDescription?.trim() ||
    event.description?.trim() ||
    `Register for ${event.title} on TeamApo Hub, Google Developer Groups (GDG) Davao.`;

  const startDate = parseDate(event.startDate);
  const formattedDate = formatDisplayDate(startDate);

  const venueName = event.venue?.type === 'online' ? 'Online Event' : event.venue?.name || event.venue?.city;

  const parts = [baseDescription];
  if (formattedDate) parts.push(formattedDate);
  if (venueName) parts.push(venueName);

  const full = parts.join(' | ');
  if (full.length > 280) {
    return full.slice(0, 277) + '...';
  }
  return full;
}

/**
 * Injects OpenGraph, Twitter Card, and Schema.org metadata into raw HTML template.
 */
export function buildEventHtmlWithMeta(
  templateHtml: string,
  event: EventMetadata,
  siteUrl: string = DEFAULT_SITE_URL
): string {
  const title = `${event.title} | ${DEFAULT_SITE_NAME}`;
  const description = buildEventMetaDescription(event);
  const imageUrl = event.imageUrl || event.bannerUrl || DEFAULT_OG_IMAGE;
  const canonicalPath = event.slug ? `/e/${event.slug}` : `/events/${event.id}/register`;
  const canonicalUrl = `${siteUrl.replace(/\/$/, '')}${canonicalPath}`;

  const startDate = parseDate(event.startDate);
  const endDate = parseDate(event.endDate);

  const tags: Record<string, string> = {
    // OpenGraph
    'og:type': 'event',
    'og:site_name': DEFAULT_SITE_NAME,
    'og:title': title,
    'og:description': description,
    'og:url': canonicalUrl,
    'og:image': imageUrl,
    'og:image:secure_url': imageUrl,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': `${event.title} Event Banner`,
    // Twitter Card
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': imageUrl,
    'twitter:image:alt': `${event.title} Event Banner`,
    'twitter:url': canonicalUrl,
    // Standard metadata
    description: description,
  };

  if (startDate) {
    tags['event:start_time'] = startDate.toISOString();
  }
  if (endDate) {
    tags['event:end_time'] = endDate.toISOString();
  }

  // Schema.org JSON-LD
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: description,
    image: imageUrl,
    url: canonicalUrl,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    location:
      event.venue?.type === 'online'
        ? {
            '@type': 'VirtualLocation',
            url: event.venue?.onlineDetails?.meetingUrl || canonicalUrl,
          }
        : {
            '@type': 'Place',
            name: event.venue?.name || 'Venue TBA',
            address: {
              '@type': 'PostalAddress',
              streetAddress: event.venue?.address || '',
              addressLocality: event.venue?.city || 'Davao City',
              addressCountry: 'PH',
            },
          },
    organizer: {
      '@type': 'Organization',
      name: event.organizer?.name || 'GDG Davao',
      url: 'https://gdgdavao.org',
    },
  };

  let output = templateHtml;

  // Replace <title>
  const escapedTitle = escapeHtml(title);
  if (/<title>[\s\S]*?<\/title>/i.test(output)) {
    output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`);
  } else {
    output = output.replace('</head>', `  <title>${escapedTitle}</title>\n</head>`);
  }

  // Remove pre-existing default OG/Twitter/canonical/JSON-LD tags to eliminate duplicates
  output = output.replace(/\n?\s*<meta\s+(property|name)=["'](og:|twitter:)[^"']*["'][^>]*>/gi, '');
  output = output.replace(/\n?\s*<meta\s+name=["']description["'][^>]*>/gi, '');
  output = output.replace(/\n?\s*<link\s+rel=["']canonical["'][^>]*>/gi, '');
  output = output.replace(/\n?\s*<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const metaLines: string[] = [];
  metaLines.push(`  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

  for (const [key, val] of Object.entries(tags)) {
    if (!val) continue;
    const isProp = key.startsWith('og:') || key.startsWith('event:');
    const attr = isProp ? 'property' : 'name';
    metaLines.push(`  <meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(val)}" />`);
  }

  metaLines.push(`  <script type="application/ld+json">\n${JSON.stringify(structuredData, null, 2)}\n  </script>`);

  const injectedBlock = '\n' + metaLines.join('\n') + '\n';
  return output.replace('</head>', `${injectedBlock}</head>`);
}

/**
 * Queries public Firestore REST API for a published event by slug or document ID.
 * Works seamlessly in serverless / edge environments with ZERO secret service accounts required.
 */
export async function fetchEventFromFirestore(
  identifier: { slug?: string; id?: string },
  projectId: string = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'project-iris-gdgdavao'
): Promise<EventMetadata | null> {
  const host = process.env.FIRESTORE_EMULATOR_HOST
    ? `http://${process.env.FIRESTORE_EMULATOR_HOST}`
    : 'https://firestore.googleapis.com';

  try {
    if (identifier.id) {
      const url = `${host}/v1/projects/${projectId}/databases/(default)/documents/events/${encodeURIComponent(identifier.id)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const doc = (await res.json()) as Record<string, unknown>;
      const data = parseFirestoreDocument(doc);
      return { id: identifier.id, ...data } as unknown as EventMetadata;
    }

    if (identifier.slug) {
      const url = `${host}/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
      // Note: Query must filter by isPublished == true and status in ['published', 'ongoing'] to satisfy Firestore Security Rules!
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'events' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'slug' },
                      op: 'EQUAL',
                      value: { stringValue: identifier.slug },
                    },
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'isPublished' },
                      op: 'EQUAL',
                      value: { booleanValue: true },
                    },
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'status' },
                      op: 'IN',
                      value: {
                        arrayValue: {
                          values: [
                            { stringValue: 'published' },
                            { stringValue: 'ongoing' },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
            limit: 1,
          },
        }),
      });

      if (!res.ok) return null;
      const items = (await res.json()) as Array<{ document?: Record<string, unknown> }>;
      if (!Array.isArray(items) || items.length === 0 || !items[0].document) {
        return null;
      }

      const doc = items[0].document;
      const name = typeof doc.name === 'string' ? doc.name : '';
      const id = name.split('/').pop() || identifier.slug;
      const data = parseFirestoreDocument(doc);
      return { id, ...data } as unknown as EventMetadata;
    }
  } catch (error) {
    console.error('[openGraph] Failed to fetch event from Firestore REST API:', error);
    return null;
  }

  return null;
}
