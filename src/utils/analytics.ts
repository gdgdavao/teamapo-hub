// Google Analytics utility
// Add your Google Analytics Measurement ID here
const GA_MEASUREMENT_ID = 'GA_MEASUREMENT_ID'; // Replace with your actual GA4 Measurement ID

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Initialize Google Analytics
export const initGA = (measurementId: string = GA_MEASUREMENT_ID) => {
  // Load gtag script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script1);

  // Initialize gtag
  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', {
      page_title: document.title,
      page_location: window.location.href,
    });
  `;
  document.head.appendChild(script2);
};

// Track page views
export const trackPageView = (path: string, title?: string) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: title || document.title,
      page_location: window.location.origin + path,
    });
  }
};

// Track events
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track custom events
export const trackCustomEvent = (eventName: string, parameters?: object) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', eventName, parameters);
  }
};

// Common event tracking functions
export const trackSocialClick = (platform: string) => {
  trackEvent('click', 'social', platform);
};

export const trackExternalLink = (url: string) => {
  trackEvent('click', 'external_link', url);
};

export const trackFormSubmission = (formName: string) => {
  trackEvent('submit', 'form', formName);
};

export const trackDownload = (fileName: string) => {
  trackEvent('download', 'file', fileName);
};
