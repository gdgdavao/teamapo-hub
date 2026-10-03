import { promises as fs } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// ─────────────────────────────────────────────────────────────────────────────
// Meta Tag Utilities
// ─────────────────────────────────────────────────────────────────────────────

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const insertBeforeHeadClose = (html, fragment) => {
  const headCloseIndex = html.toLowerCase().indexOf('</head>')
  if (headCloseIndex === -1) {
    return `${html}${fragment}`
  }
  return `${html.slice(0, headCloseIndex)}${fragment}${html.slice(headCloseIndex)}`
}

const removeMeta = (html, attribute, key) => {
  const pattern = `\\n?\\s*<meta[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*>`
  return html.replace(new RegExp(pattern, 'gi'), '')
}

const upsertMeta = (html, attribute, key, value) => {
  const sanitized = value ? escapeHtml(value) : undefined
  const metaRegex = new RegExp(
    `<meta[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*>`,
    'i',
  )

  if (!sanitized) {
    return removeMeta(html, attribute, key)
  }

  const replacement = `<meta ${attribute}="${key}" content="${sanitized}" />`

  if (metaRegex.test(html)) {
    return html.replace(metaRegex, replacement)
  }

  return insertBeforeHeadClose(html, `\n    ${replacement}`)
}

const replaceTitle = (html, title) => {
  const sanitized = escapeHtml(title)
  const titleRegex = /<title>[\s\S]*?<\/title>/i

  if (titleRegex.test(html)) {
    return html.replace(titleRegex, `<title>${sanitized}</title>`)
  }

  return insertBeforeHeadClose(html, `\n    <title>${sanitized}</title>`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin Initialization & Event Fetching
// ─────────────────────────────────────────────────────────────────────────────

const initFirebaseAdmin = async () => {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const { getStorage } = await import('firebase-admin/storage')

    if (getApps().length > 0) {
      return { db: getFirestore(), storage: getStorage() }
    }

    // Load service account from file
    const serviceAccountPath = path.resolve('firebase-service-account.json')
    const serviceAccountContent = await fs.readFile(serviceAccountPath, 'utf-8')
    const serviceAccount = JSON.parse(serviceAccountContent)

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
    })
    return { db: getFirestore(), storage: getStorage() }
  } catch (error) {
    console.warn('[event-static-html] Failed to initialize Firebase Admin:', error.message)
    return { db: null, storage: null }
  }
}

/**
 * Resolve Firebase Storage path to a public download URL
 * Handles various URL formats:
 * - Already HTTPS URLs: return as-is
 * - gs:// URLs: convert to public URL
 * - Storage paths: convert to public URL
 */
const resolveStorageUrl = async (storage, imageUrl, defaultImage) => {
  if (!imageUrl) return defaultImage
  
  // Already a public HTTPS URL
  if (imageUrl.startsWith('https://')) {
    return imageUrl
  }

  try {
    const bucket = storage.bucket()
    let filePath = imageUrl

    // Handle gs:// URLs
    if (imageUrl.startsWith('gs://')) {
      const gsUrl = new URL(imageUrl)
      filePath = gsUrl.pathname.slice(1) // Remove leading slash
    }

    const file = bucket.file(filePath)
    const [exists] = await file.exists()
    
    if (!exists) {
      console.warn(`[event-static-html] Image file not found: ${filePath}`)
      return defaultImage
    }

    // Generate a signed URL that expires in 1 year (for social sharing)
    // Or use the public URL if the file is public
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    })
    
    return signedUrl
  } catch (error) {
    console.warn(`[event-static-html] Failed to resolve storage URL: ${imageUrl}`, error.message)
    return defaultImage
  }
}

const resolveSiteUrl = () => {
  const explicitUrl = process.env.VITE_APP_URL || process.env.VITE_SITE_URL
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL

  if (explicitUrl) {
    return explicitUrl.startsWith('http') ? explicitUrl : `https://${explicitUrl}`
  }

  if (vercelDomain) {
    return vercelDomain.startsWith('http') ? vercelDomain : `https://${vercelDomain}`
  }

  return 'https://apohub.gdgdavao.org'
}

const fetchPublishedEvents = async (db) => {
  if (!db) {
    console.warn('[event-static-html] No database connection available')
    return []
  }

  try {
    const eventsRef = db.collection('events')
    const snapshot = await eventsRef
      .where('isPublished', '==', true)
      .where('status', '==', 'published')
      .get()

    const events = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      events.push({
        id: doc.id,
        slug: data.slug || null,
        title: data.title || 'Untitled Event',
        description: data.description || '',
        shortDescription: data.shortDescription || data.description || '',
        imageUrl: data.imageUrl || data.bannerUrl || null,
        startDate: data.startDate?.toDate?.() || null,
        endDate: data.endDate?.toDate?.() || null,
        venue: data.venue || {},
        organizer: data.organizer || {},
        ticketTypes: data.ticketTypes || [],
        tags: data.tags || [],
        category: data.category || 'General',
      })
    })

    return events
  } catch (error) {
    console.error('[event-static-html] Error fetching events:', error)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Static HTML Plugin
// ─────────────────────────────────────────────────────────────────────────────

const createEventStaticHtmlPlugin = () => ({
  name: 'gdg-event-static-html',
  apply: 'build',
  async closeBundle() {
    const distIndexPath = path.resolve('dist', 'index.html')
    const siteUrl = resolveSiteUrl()

    // Check if dist/index.html exists
    const distIndexExists = await fs
      .access(distIndexPath)
      .then(() => true)
      .catch(() => false)

    if (!distIndexExists) {
      console.warn('[event-static-html] dist/index.html not found. Skipping static event page generation.')
      return
    }

    // Initialize Firebase Admin and fetch events
    const { db, storage } = await initFirebaseAdmin()
    const events = await fetchPublishedEvents(db)

    if (events.length === 0) {
      console.warn('[event-static-html] No published events found. Skipping static event page generation.')
      return
    }

    const template = await fs.readFile(distIndexPath, 'utf-8')
    const defaultImage = 'https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png'

    await Promise.all(
      events.map(async (event) => {
        const {
          id,
          slug,
          title,
          shortDescription,
          description,
          imageUrl,
          startDate,
          endDate,
          venue,
          organizer,
          ticketTypes,
          tags,
        } = event

        // Use slug-based URL if available, otherwise fall back to ID
        const eventUrl = slug 
          ? `${siteUrl}/e/${slug}`
          : `${siteUrl}/events/${id}/register`
        const eventDescription = shortDescription || description || 'Join us for this exciting event!'
        
        // Resolve event image URL from Firebase Storage if needed
        const eventImage = storage 
          ? await resolveStorageUrl(storage, imageUrl, defaultImage)
          : (imageUrl || defaultImage)
        
        console.log(`[event-static-html] Event: ${title}`)
        console.log(`  - Slug: ${slug || '(none)'}`)
        console.log(`  - Original imageUrl: ${imageUrl || '(none)'}`)
        console.log(`  - Resolved eventImage: ${eventImage === defaultImage ? '(default)' : eventImage.substring(0, 80) + '...'}`)
        
        const pageTitle = `${title} | TeamApo Hub`

        // Format date for display
        const formatEventDate = (date) => {
          if (!date) return null
          return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        }

        const formattedStartDate = formatEventDate(startDate)
        const formattedEndDate = formatEventDate(endDate)
        const dateString = formattedStartDate
          ? formattedEndDate && formattedStartDate !== formattedEndDate
            ? `${formattedStartDate} - ${formattedEndDate}`
            : formattedStartDate
          : null

        // Generate meta description with date/venue info
        let metaDescription = eventDescription
        if (dateString) {
          metaDescription += ` | ${dateString}`
        }
        if (venue?.name || venue?.city) {
          metaDescription += ` | ${venue.name || venue.city}`
        }

        // Build HTML with updated meta tags
        let html = template
        html = replaceTitle(html, pageTitle)
        html = upsertMeta(html, 'name', 'description', metaDescription)

        // Open Graph
        html = upsertMeta(html, 'property', 'og:title', pageTitle)
        html = upsertMeta(html, 'property', 'og:description', metaDescription)
        html = upsertMeta(html, 'property', 'og:image', eventImage)
        html = upsertMeta(html, 'property', 'og:image:secure_url', eventImage)
        html = upsertMeta(html, 'property', 'og:image:alt', `${title} Event Banner`)
        html = upsertMeta(html, 'property', 'og:url', eventUrl)
        html = upsertMeta(html, 'property', 'og:type', 'event')
        html = upsertMeta(html, 'property', 'og:site_name', 'TeamApo Hub')

        // Twitter Card
        html = upsertMeta(html, 'name', 'twitter:title', pageTitle)
        html = upsertMeta(html, 'name', 'twitter:description', metaDescription)
        html = upsertMeta(html, 'name', 'twitter:image', eventImage)
        html = upsertMeta(html, 'name', 'twitter:image:alt', `${title} Event Banner`)
        html = upsertMeta(html, 'name', 'twitter:url', eventUrl)
        html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image')

        // Generic image meta
        html = upsertMeta(html, 'name', 'image', eventImage)

        // Add canonical link
        const canonicalLink = `\n    <link rel="canonical" href="${escapeHtml(eventUrl)}" />`
        // Remove existing canonical if any
        html = html.replace(/\n?\s*<link[^>]*rel=["']canonical["'][^>]*>/gi, '')
        html = insertBeforeHeadClose(html, canonicalLink)

        // Event-specific meta tags
        if (startDate) {
          html = upsertMeta(html, 'property', 'event:start_time', startDate.toISOString())
        }
        if (endDate) {
          html = upsertMeta(html, 'property', 'event:end_time', endDate.toISOString())
        }

        // Add structured data (JSON-LD)
        const structuredData = {
          '@context': 'https://schema.org',
          '@type': 'Event',
          name: title,
          description: eventDescription,
          image: eventImage,
          url: eventUrl,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          location:
            venue?.type === 'online'
              ? {
                  '@type': 'VirtualLocation',
                  url: venue?.onlineDetails?.meetingUrl || eventUrl,
                }
              : {
                  '@type': 'Place',
                  name: venue?.name || 'TBD',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: venue?.address || '',
                    addressLocality: venue?.city || 'Davao City',
                    addressCountry: 'PH',
                  },
                },
          organizer: {
            '@type': 'Organization',
            name: organizer?.name || 'GDG Davao',
            email: organizer?.email,
          },
          offers: ticketTypes?.map((ticket) => ({
            '@type': 'Offer',
            name: ticket.name,
            price: ticket.price,
            priceCurrency: ticket.currency || 'PHP',
            availability: ticket.isActive
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          })),
          keywords: tags?.join(', '),
        }

        const ldJsonScript = `\n    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>`
        html = insertBeforeHeadClose(html, ldJsonScript)

        // Write the file for ID-based route (backward compatibility)
        const outDirById = path.resolve('dist', 'events', id, 'register')
        const outPathById = path.join(outDirById, 'index.html')
        await fs.mkdir(outDirById, { recursive: true })
        await fs.writeFile(outPathById, html, 'utf-8')

        // Also write the file for slug-based route if slug exists
        if (slug) {
          const outDirBySlug = path.resolve('dist', 'e', slug)
          const outPathBySlug = path.join(outDirBySlug, 'index.html')
          await fs.mkdir(outDirBySlug, { recursive: true })
          await fs.writeFile(outPathBySlug, html, 'utf-8')
        }
      }),
    )

    console.info(`[event-static-html] Generated ${events.length} event pages with dedicated meta tags.`)
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Vite Config
// ─────────────────────────────────────────────────────────────────────────────

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createEventStaticHtmlPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    }
  },
})
