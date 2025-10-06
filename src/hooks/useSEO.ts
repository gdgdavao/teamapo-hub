import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface UseSEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogImageWidth?: string;
  ogImageHeight?: string;
  ogType?: string;
  noindex?: boolean;
  structuredData?: object;
  contextTitle?: string; // Additional context for the title
}

const useSEO = ({
  title,
  description = 'Join GDG Davao, the premier Google Developer Groups community in Davao City. Connect with fellow developers, attend tech events, and grow your skills in Google technologies.',
  keywords = 'GDG Davao, Google Developer Groups, Davao developers, tech events, programming, software development, Google technologies, developer community, tech meetups',
  ogImage = 'https://raw.githubusercontent.com/gdgdavao/assets-cdn/main/banner.png',
  ogImageAlt = 'GDG Davao Community Banner',
  ogImageWidth = '1200',
  ogImageHeight = '630',
  ogType = 'website',
  noindex = false,
  structuredData,
  contextTitle
}: UseSEOProps = {}) => {
  const location = useLocation();
  const params = useParams();
  const { userProfile } = useAuth();

  // Generate context-aware title
  const generateContextAwareTitle = (): string => {
    // If explicit title is provided, use it
    if (title) return title;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const baseTitle = 'TeamApo Hub | GDG Davao';
    
    // Handle different route patterns
    if (pathSegments.length === 0 || pathSegments[0] === 'dashboard') {
      if (userProfile?.role === 'admin') {
        return `Admin Dashboard | ${baseTitle}`;
      } else if (userProfile?.role === 'organizer') {
        return `Organizer Dashboard | ${baseTitle}`;
      }
      return `Dashboard | ${baseTitle}`;
    }

    // Handle auth routes
    if (pathSegments[0] === 'auth') {
      const authPage = pathSegments[1];
      switch (authPage) {
        case 'login':
          return `Sign In | ${baseTitle}`;
        case 'signup':
          return `Sign Up | ${baseTitle}`;
        case 'forgot-password':
          return `Reset Password | ${baseTitle}`;
        default:
          return `Authentication | ${baseTitle}`;
      }
    }

    // Handle admin routes
    if (pathSegments[0] === 'admin') {
      const adminPage = pathSegments[1];
      switch (adminPage) {
        case 'dashboard':
          return `Admin Dashboard | ${baseTitle}`;
        case 'users':
          return `User Management | ${baseTitle}`;
        case 'events':
          if (pathSegments[2] === 'create') {
            return `Create Event | ${baseTitle}`;
          } else if (pathSegments[2] === 'edit' && params.eventId) {
            return `Edit Event | ${baseTitle}`;
          } else if (pathSegments[3] === 'attendees' && params.eventId) {
            return `Event Attendees | ${baseTitle}`;
          } else if (pathSegments[3] === 'analytics' && params.eventId) {
            return `Event Analytics | ${baseTitle}`;
          }
          return `Manage Events | ${baseTitle}`;
        case 'checkin':
          return `Check-in Management | ${baseTitle}`;
        case 'analytics':
          return `Analytics Dashboard | ${baseTitle}`;
        default:
          return `Admin Panel | ${baseTitle}`;
      }
    }

    // Handle organizer routes
    if (pathSegments[0] === 'organizer') {
      const organizerPage = pathSegments[1];
      switch (organizerPage) {
        case 'dashboard':
          return `Organizer Dashboard | ${baseTitle}`;
        case 'checkin':
          return `Event Check-in | ${baseTitle}`;
        default:
          return `Organizer Panel | ${baseTitle}`;
      }
    }

    // Handle shared routes
    switch (pathSegments[0]) {
      case 'events':
        if (pathSegments[1] === 'create') {
          return `Create Event | ${baseTitle}`;
        } else if (pathSegments[1] === 'edit' && params.eventId) {
          return `Edit Event | ${baseTitle}`;
        } else if (pathSegments[2] === 'register' && params.eventId) {
          return `Event Registration | ${baseTitle}`;
        } else if (pathSegments[2] === 'attendees' && params.eventId) {
          return `Event Attendees | ${baseTitle}`;
        } else if (pathSegments[2] === 'analytics' && params.eventId) {
          return `Event Analytics | ${baseTitle}`;
        }
        return `Events | ${baseTitle}`;
      case 'attendees':
        return `Attendees | ${baseTitle}`;
      case 'analytics':
        return `Analytics | ${baseTitle}`;
      case 'certificates':
        return `Certificates | ${baseTitle}`;
      case 'users':
        return `User Management | ${baseTitle}`;
      case 'payment':
        if (params.registrationId) {
          return `Payment | ${baseTitle}`;
        } else if (pathSegments[1] === 'success') {
          return `Payment Success | ${baseTitle}`;
        }
        return `Payment | ${baseTitle}`;
      case 'feedback':
        if (params.eventId) {
          return `Event Feedback | ${baseTitle}`;
        }
        return `Feedback | ${baseTitle}`;
      case 'verify':
        return `Certificate Verification | ${baseTitle}`;
      default:
        // Handle login route
        if (pathSegments[0] === 'login') {
          return `Sign In | ${baseTitle}`;
        }
        return baseTitle;
    }
  };

  const finalTitle = generateContextAwareTitle();

  useEffect(() => {
    // Update document title
    document.title = finalTitle;

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
    updateMetaTag('og:title', finalTitle, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:type', ogType, true);
    updateMetaTag('og:url', currentUrl, true);
    updateMetaTag('og:site_name', 'TeamApo Hub', true);
    updateMetaTag('og:locale', 'en_US', true);
    
    // Update Open Graph image tags
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:image:secure_url', ogImage, true);
    updateMetaTag('og:image:width', ogImageWidth, true);
    updateMetaTag('og:image:height', ogImageHeight, true);
    updateMetaTag('og:image:alt', ogImageAlt, true);
    
    // Some scrapers also look for a generic image meta
    updateMetaTag('image', ogImage);

    // Update Twitter tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', finalTitle, true);
    updateMetaTag('twitter:description', description, true);
    updateMetaTag('twitter:image', ogImage, true);
    updateMetaTag('twitter:image:alt', ogImageAlt, true);
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

  }, [finalTitle, description, keywords, ogImage, ogImageAlt, ogImageWidth, ogImageHeight, ogType, noindex, structuredData, location.pathname, userProfile?.role]);
};

export default useSEO;
