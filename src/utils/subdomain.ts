/**
 * Utility functions for handling subdomain-based routing
 */

// Configuration flag to enable/disable apohub subdomain functionality for admin and organizer roles
const APOHUB_SUBDOMAIN_ENABLED = true; // Set to true to enable apohub subdomain

export const getSubdomain = (): string | null => {
  const host = window.location.hostname;
  const parts = host.split('.');
  
  // Special handling for localhost development
  if (host.includes('localhost')) {
    // For patterns like apohub.localhost or apohub.apohub.localhost
    if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
      // Find the part before 'localhost'
      const beforeLocalhost = parts[parts.length - 2];
      if (beforeLocalhost !== 'localhost') {
        return beforeLocalhost;
      }
    }
    // For plain localhost
    if (host === 'localhost') {
      return null;
    }
    return null;
  }
  
  // If IP address, return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }
  
  // For production domains like apohub.example.com
  if (parts.length >= 3) {
    return parts[0];
  }
  
  // If only one part (no subdomain), return null
  return null;
};

export const isApohubSubdomain = (): boolean => {
  if (!APOHUB_SUBDOMAIN_ENABLED) {
    return false;
  }
  const subdomain = getSubdomain();
  return subdomain === 'apohub';
};

// Legacy function name for backward compatibility
export const isAdminSubdomain = (): boolean => {
  return isApohubSubdomain();
};

export const isMainDomain = (): boolean => {
  const subdomain = getSubdomain();
  return subdomain === null || subdomain === 'www';
};

export const getApohubUrl = (path: string = ''): string => {
  if (!APOHUB_SUBDOMAIN_ENABLED) {
    // When apohub subdomain is disabled, return main domain URL
    return getMainUrl(path);
  }
  
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  
  // For localhost development
  if (host.includes('localhost')) {
    const portPart = port ? `:${port}` : '';
    // If we're already on apohub.localhost, don't add another apohub
    if (host.startsWith('apohub.')) {
      return `${protocol}//${host}${portPart}${path}`;
    }
    return `${protocol}//apohub.localhost${portPart}${path}`;
  }
  
  // For IP addresses
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const portPart = port ? `:${port}` : '';
    return `${protocol}//apohub.${host}${portPart}${path}`;
  }
  
  // For production domains
  const parts = host.split('.');
  const baseDomain = parts.slice(-2).join('.');
  const portPart = port ? `:${port}` : '';
  
  // If already on apohub subdomain, don't add another apohub
  if (parts[0] === 'apohub') {
    return `${protocol}//${host}${portPart}${path}`;
  }
  
  return `${protocol}//apohub.${baseDomain}${portPart}${path}`;
};

// Legacy function name for backward compatibility
export const getAdminUrl = (path: string = ''): string => {
  return getApohubUrl(path);
};

export const getMainUrl = (path: string = ''): string => {
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  
  // For localhost development
  if (host.includes('localhost')) {
    const portPart = port ? `:${port}` : '';
    return `${protocol}//localhost${portPart}${path}`;
  }
  
  // For IP addresses
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const portPart = port ? `:${port}` : '';
    return `${protocol}//${host}${portPart}${path}`;
  }
  
  // For production domains
  const parts = host.split('.');
  const baseDomain = parts.slice(-2).join('.');
  const portPart = port ? `:${port}` : '';
  
  return `${protocol}//${baseDomain}${portPart}${path}`;
};

// Debug function to help troubleshoot subdomain detection
export const debugSubdomain = () => {
  const host = window.location.hostname;
  const parts = host.split('.');
  const subdomain = getSubdomain();
  
  console.log('Subdomain Debug:', {
    host,
    parts,
    subdomain,
    isApohub: isApohubSubdomain(),
    isMain: isMainDomain(),
    apohubUrl: getApohubUrl(),
    mainUrl: getMainUrl()
  });
};
