import React from 'react';

/** Lets keyboard users jump the sidebar nav straight to page content. */
const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-3 focus:bg-white focus:text-primary-hover focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-primary"
  >
    Skip to main content
  </a>
);

export default SkipLink;
