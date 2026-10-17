import type { IncomingMessage, ServerResponse } from 'node:http';

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

const DEFAULT_OG_IMAGE = 'https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png';
const DEFAULT_SITE_URL = 'https://apohub.gdgdavao.org';
const DEFAULT_SITE_NAME = 'TeamApo Hub';
const DEFAULT_PROJECT_ID = 'project-iris-gdgdavao';

const BASE_HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TeamApo Hub | GDG Davao</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseFirestoreDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const fields = (doc.fields || {}) as Record<string, Record<string, unknown>>;
  const result: Record<string, unknown> = {};

  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj || typeof valObj !== 'object') continue;

    if ('stringValue' in valObj) {
      result[key] = valObj.stringValue;
    } else if ('booleanValue' in valObj) {
      result[key] = valObj.booleanValue;
    } else if ('integerValue' in valObj) {
      result[key] = Number.parseInt(valObj.integerValue as string, 10);
    } else if ('doubleValue' in valObj) {
      result[key] = Number.parseFloat(valObj.doubleValue as string);
    } else if ('timestampValue' in valObj) {
      result[key] = valObj.timestampValue;
    } else if ('mapValue' in valObj) {
      result[key] = parseFirestoreDocument(valObj.mapValue as Record<string, unknown>);
    } else if ('arrayValue' in valObj) {
      const arr = (valObj.arrayValue as { values?: Array<Record<string, unknown>> })?.values || [];
      result[key] = arr.map((item) => {
        if ('stringValue' in item) return item.stringValue;
        if ('mapValue' in item) return parseFirestoreDocument(item.mapValue as Record<string, unknown>);
        return item;
      });
    }
  }

  return result;
}

function buildEventMetaDescription(event: EventMetadata): string {
  const summary = event.shortDescription?.trim() || event.description?.trim() || 'Join us for this GDG Davao event.';
  const venueText = event.venue?.name ? ` at ${event.venue.name}` : '';
  const dateStr = event.startDate
    ? ` on ${new Date(typeof event.startDate === 'object' && 'seconds' in event.startDate && event.startDate.seconds ? event.startDate.seconds * 1000 : event.startDate as string | Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}`
    : '';

  return `${summary} Happening${venueText}${dateStr}. Register now on TeamApo Hub.`;
}

function buildEventHtmlWithMeta(template: string, event: EventMetadata, siteUrl: string = DEFAULT_SITE_URL): string {
  const cleanSiteUrl = siteUrl.replace(/\/+$/, '');
  const eventPath = event.slug ? `/e/${event.slug}` : `/events/${event.id}/register`;
  const canonicalUrl = `${cleanSiteUrl}${eventPath}`;

  const title = `${event.title} | TeamApo Hub`;
  const description = buildEventMetaDescription(event);
  const ogImage = event.imageUrl || event.bannerUrl || DEFAULT_OG_IMAGE;

  let isoStartDate: string | undefined;
  let isoEndDate: string | undefined;

  if (event.startDate) {
    const ms = typeof event.startDate === 'object' && 'seconds' in event.startDate && event.startDate.seconds
      ? event.startDate.seconds * 1000
      : new Date(event.startDate as string | Date).getTime();
    if (!Number.isNaN(ms)) isoStartDate = new Date(ms).toISOString();
  }

  if (event.endDate) {
    const ms = typeof event.endDate === 'object' && 'seconds' in event.endDate && event.endDate.seconds
      ? event.endDate.seconds * 1000
      : new Date(event.endDate as string | Date).getTime();
    if (!Number.isNaN(ms)) isoEndDate = new Date(ms).toISOString();
  }

  const tags: Record<string, string> = {
    'og:type': 'event',
    'og:title': title,
    'og:description': description,
    'og:url': canonicalUrl,
    'og:image': ogImage,
    'og:image:secure_url': ogImage,
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:alt': `${event.title} Cover`,
    'og:site_name': DEFAULT_SITE_NAME,
    'og:locale': 'en_US',

    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': ogImage,
    'twitter:image:alt': `${event.title} Cover`,
    'twitter:url': canonicalUrl,

    'description': description,
    'image': ogImage,
  };

  if (isoStartDate) tags['event:start_time'] = isoStartDate;
  if (isoEndDate) tags['event:end_time'] = isoEndDate;

  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': event.title,
    'description': description,
    'image': [ogImage],
    'url': canonicalUrl,
    'eventStatus': 'https://schema.org/EventScheduled',
    'eventAttendanceMode':
      event.venue?.type === 'online'
        ? 'https://schema.org/OnlineEventAttendanceMode'
        : event.venue?.type === 'hybrid'
          ? 'https://schema.org/MixedEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
    'organizer': {
      '@type': 'Organization',
      'name': event.organizer?.name || 'GDG Davao',
      'url': cleanSiteUrl,
    },
  };

  if (isoStartDate) structuredData.startDate = isoStartDate;
  if (isoEndDate) structuredData.endDate = isoEndDate;

  if (event.venue) {
    if (event.venue.type === 'online') {
      structuredData.location = {
        '@type': 'VirtualLocation',
        'url': event.venue.onlineDetails?.meetingUrl || canonicalUrl,
      };
    } else {
      structuredData.location = {
        '@type': 'Place',
        'name': event.venue.name || 'Venue TBA',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': event.venue.city || 'Davao City',
          'streetAddress': event.venue.address || event.venue.name || '',
          'addressCountry': 'PH',
        },
      };
    }
  }

  let output = template;
  const escapedTitle = escapeHtml(title);

  if (/<title>[\s\S]*?<\/title>/i.test(output)) {
    output = output.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`);
  } else {
    output = output.replace('</head>', `  <title>${escapedTitle}</title>\n</head>`);
  }

  // Deduplicate previous meta/links
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

async function fetchEventFromFirestore(
  identifier: { slug?: string; id?: string },
  projectId: string = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID
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

function sendResponse(
  res: any,
  statusCode: number,
  body: string,
  headers: Record<string, string> = {}
) {
  if (res) {
    try {
      if (typeof res.setHeader === 'function') {
        for (const [key, val] of Object.entries(headers)) {
          res.setHeader(key, val);
        }
      }
      if (typeof res.status === 'function') {
        res.status(statusCode);
      } else {
        res.statusCode = statusCode;
      }
      if (typeof res.send === 'function') {
        res.send(body);
        return;
      }
      if (typeof res.end === 'function') {
        res.end(body);
        return;
      }
    } catch (e) {
      console.warn('[event-meta] Notice while writing to ServerResponse:', e);
    }
  }

  return new Response(body, {
    status: statusCode,
    headers,
  });
}

export default async function handler(req: any, res?: any) {
  let slug: string | undefined;
  let id: string | undefined;

  // Extract query parameters from Node req or Web Request
  if (req?.query) {
    if (typeof req.query.slug === 'string') slug = req.query.slug;
    if (typeof req.query.id === 'string') id = req.query.id;
  }

  const rawUrl = req?.url || (typeof req?.text === 'function' ? req.url : undefined);
  if (!slug && !id && rawUrl) {
    try {
      const urlObj = new URL(rawUrl, 'http://localhost');
      slug = urlObj.searchParams.get('slug') || undefined;
      id = urlObj.searchParams.get('id') || undefined;
    } catch {
      // Ignore URL parse error
    }
  }

  const siteUrl = process.env.VITE_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${(process.env.VITE_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)!.replace(/^https?:\/\//, '')}`
    : DEFAULT_SITE_URL;

  // If no identifier provided, return base template with 200 OK
  if (!slug && !id) {
    return sendResponse(res, 200, BASE_HTML_TEMPLATE, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }

  try {
    const event = await fetchEventFromFirestore({ slug, id });

    if (!event) {
      // Event not found or draft, safely return base template with standard tags
      return sendResponse(res, 200, BASE_HTML_TEMPLATE, {
        'Content-Type': 'text/html; charset=utf-8',
      });
    }

    const html = buildEventHtmlWithMeta(BASE_HTML_TEMPLATE, event, siteUrl);

    // Cache at edge for 1 hour, serve stale up to 24 hours while revalidating
    return sendResponse(res, 200, html, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    });
  } catch (error) {
    console.error('[event-meta] Failed to generate dynamic meta tags:', error);
    return sendResponse(res, 200, BASE_HTML_TEMPLATE, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }
}
