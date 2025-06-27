import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  noindex?: boolean;
}

const SEOComponent: React.FC<SEOProps> = ({
  title = 'GDG Davao | Google Developer Groups - Davao',
  description = 'Join GDG Davao, the premier Google Developer Groups community in Davao City. Connect with fellow developers, attend tech events, and grow your skills in Google technologies.',
  keywords = 'GDG Davao, Google Developer Groups, Davao developers, tech events, programming, software development, Google technologies, developer community, tech meetups',
  ogImage = 'https://gdgdavao.org/gdgdvo.svg',
  ogType = 'website',
  canonical,
  noindex = false,
}) => {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      
      meta.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    
    // Update robots meta tag
    const robotsContent = noindex ? 'noindex, nofollow' : 'index, follow';
    updateMetaTag('robots', robotsContent);

    // Update Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', ogType, true);
    updateMetaTag('og:url', window.location.href, true);

    // Update Twitter tags
    updateMetaTag('twitter:title', title, true);
    updateMetaTag('twitter:description', description, true);
    updateMetaTag('twitter:image', ogImage, true);
    updateMetaTag('twitter:url', window.location.href, true);

    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical || window.location.href);

    // Add structured data for the current page
    const addStructuredData = (data: object) => {
      const existingScript = document.querySelector('script[type="application/ld+json"]#page-data');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('id', 'page-data');
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    };

    // Add page-specific structured data
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description: description,
      url: window.location.href,
      image: ogImage,
      isPartOf: {
        '@type': 'WebSite',
        name: 'GDG Davao',
        url: 'https://gdgdavao.org'
      }
    };

    addStructuredData(structuredData);

  }, [title, description, keywords, ogImage, ogType, canonical, noindex]);

  return null; // This component doesn't render anything
};

export default SEOComponent;
