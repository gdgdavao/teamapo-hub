/**
 * Utility functions for handling subdomain-based routing
 */

// Configuration flag to enable/disable admin subdomain functionality
const ADMIN_SUBDOMAIN_ENABLED = false; // Set to true to enable admin subdomain

export const getSubdomain = (): string | null => {
  const host = window.location.hostname;
  const parts = host.split('.');
  
  // Special handling for localhost development
  if (host.includes('localhost')) {
    // For patterns like admin.localhost or admin.admin.localhost
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
  
  // For production domains like admin.example.com
  if (parts.length >= 3) {
    return parts[0];
  }
  
  // If only one part (no subdomain), return null
  return null;
};

export const isAdminSubdomain = (): boolean => {
  if (!ADMIN_SUBDOMAIN_ENABLED) {
    return false;
  }
  const subdomain = getSubdomain();
  return subdomain === 'admin';
};

export const isMainDomain = (): boolean => {
  const subdomain = getSubdomain();
  return subdomain === null || subdomain === 'www';
};

export const getAdminUrl = (path: string = ''): string => {
  if (!ADMIN_SUBDOMAIN_ENABLED) {
    // When admin subdomain is disabled, return main domain URL
    return getMainUrl(path);
  }
  
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  
  // For localhost development
  if (host.includes('localhost')) {
    const portPart = port ? `:${port}` : '';
    // If we're already on admin.localhost, don't add another admin
    if (host.startsWith('admin.')) {
      return `${protocol}//${host}${portPart}${path}`;
    }
    return `${protocol}//admin.localhost${portPart}${path}`;
  }
  
  // For IP addresses
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const portPart = port ? `:${port}` : '';
    return `${protocol}//admin.${host}${portPart}${path}`;
  }
  
  // For production domains
  const parts = host.split('.');
  const baseDomain = parts.slice(-2).join('.');
  const portPart = port ? `:${port}` : '';
  
  // If already on admin subdomain, don't add another admin
  if (parts[0] === 'admin') {
    return `${protocol}//${host}${portPart}${path}`;
  }
  
  return `${protocol}//admin.${baseDomain}${portPart}${path}`;
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
    isAdmin: isAdminSubdomain(),
    isMain: isMainDomain(),
    adminUrl: getAdminUrl(),
    mainUrl: getMainUrl()
  });
};
