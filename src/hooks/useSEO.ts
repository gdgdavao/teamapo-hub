import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface UseSEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  structuredData?: object;
}

const useSEO = ({
  title = 'GDG Davao | Google Developer Groups - Davao',
  description = 'Join GDG Davao, the premier Google Developer Groups community in Davao City. Connect with fellow developers, attend tech events, and grow your skills in Google technologies.',
  keywords = 'GDG Davao, Google Developer Groups, Davao developers, tech events, programming, software development, Google technologies, developer community, tech meetups',
  ogImage = 'https://gdgdavao.org/gdgdvo.svg',
  ogType = 'website',
  noindex = false,
  structuredData
}: UseSEOProps = {}) => {
  const location = useLocation();

  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper function to update or create meta tags
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
    updateMetaTag('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Update Open Graph tags
    const currentUrl = `${window.location.origin}${location.pathname}`;
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', ogType, true);
    updateMetaTag('og:url', currentUrl, true);

    // Update Twitter tags
    updateMetaTag('twitter:title', title, true);
    updateMetaTag('twitter:description', description, true);
    updateMetaTag('twitter:image', ogImage, true);
    updateMetaTag('twitter:url', currentUrl, true);

    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', currentUrl);

    // Add structured data if provided
    if (structuredData) {
      const existingScript = document.querySelector('script[type="application/ld+json"]#page-structured-data');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('id', 'page-structured-data');
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // Clean up function
    return () => {
      // Clean up any page-specific structured data when component unmounts
      const pageScript = document.querySelector('script[type="application/ld+json"]#page-structured-data');
      if (pageScript) {
        pageScript.remove();
      }
    };

  }, [title, description, keywords, ogImage, ogType, noindex, structuredData, location.pathname]);
};

export default useSEO;
