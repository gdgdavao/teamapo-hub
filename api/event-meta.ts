import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  fetchEventFromFirestore,
  buildEventHtmlWithMeta,
  DEFAULT_SITE_URL,
} from '../src/utils/openGraph';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  url?: string;
}

interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  send: (body: string) => void;
  setHeader: (name: string, value: string) => this;
}

const FALLBACK_HTML = `<!doctype html>
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

function getTemplateHtml(): string {
  const possiblePaths = [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf-8');
      }
    } catch {
      // Continue to next path
    }
  }

  return FALLBACK_HTML;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract slug or id from query or URL
  let slug: string | undefined;
  let id: string | undefined;

  if (req.query) {
    if (typeof req.query.slug === 'string') slug = req.query.slug;
    if (typeof req.query.id === 'string') id = req.query.id;
  }

  if (!slug && !id && req.url) {
    const urlObj = new URL(req.url, 'http://localhost');
    slug = urlObj.searchParams.get('slug') || undefined;
    id = urlObj.searchParams.get('id') || undefined;
  }

  const template = getTemplateHtml();
  const siteUrl = process.env.VITE_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${(process.env.VITE_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL)!.replace(/^https?:\/\//, '')}`
    : DEFAULT_SITE_URL;

  // If no identifier provided, return base template
  if (!slug && !id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(template);
    return;
  }

  try {
    const event = await fetchEventFromFirestore({ slug, id });

    if (!event) {
      // Event not found or draft, return base template with standard tags
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(template);
      return;
    }

    const html = buildEventHtmlWithMeta(template, event, siteUrl);

    // Cache at edge for 1 hour, serve stale up to 24 hours while revalidating
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (error) {
    console.error('[event-meta] Failed to generate dynamic meta tags:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(template);
  }
}
