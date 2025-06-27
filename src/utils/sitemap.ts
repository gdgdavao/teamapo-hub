// Sitemap generator utility
// This would typically be run during build time or as a separate script

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export const generateSitemap = (urls: SitemapUrl[]): string => {
  const urlElements = urls.map(url => {
    const lastmod = url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : '';
    const changefreq = url.changefreq ? `\n    <changefreq>${url.changefreq}</changefreq>` : '';
    const priority = url.priority ? `\n    <priority>${url.priority}</priority>` : '';
    
    return `  <url>
    <loc>${url.loc}</loc>${lastmod}${changefreq}${priority}
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
};

// Default sitemap URLs for GDG Davao
export const defaultSitemapUrls: SitemapUrl[] = [
  {
    loc: 'https://gdgdavao.org/',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'weekly',
    priority: 1.0
  },
  {
    loc: 'https://gdgdavao.org/events',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'daily',
    priority: 0.9
  },
  {
    loc: 'https://gdgdavao.org/register',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'monthly',
    priority: 0.8
  },
  {
    loc: 'https://gdgdavao.org/feedback',
    lastmod: new Date().toISOString().split('T')[0],
    changefreq: 'monthly',
    priority: 0.7
  }
];

// Generate and save sitemap
export const createSitemapFile = (urls: SitemapUrl[] = defaultSitemapUrls): string => {
  return generateSitemap(urls);
};
