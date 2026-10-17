import React, { useMemo, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import apohubTitle from '../../assets/apohub-title2.svg';
import usePageTitle from '../../hooks/usePageTitle';
import { PRIVACY_POLICY, LegalDocument } from './content/privacyPolicy';
import { TERMS_OF_SERVICE } from './content/termsOfService';

interface LegalPageProps {
  documentType?: 'privacy' | 'terms';
  initialTab?: 'privacy' | 'terms';
}

const LegalPage: React.FC<LegalPageProps> = ({ documentType, initialTab }) => {
  const location = useLocation();

  const activeDoc: LegalDocument = useMemo(() => {
    const type =
      documentType ||
      (location.pathname.startsWith('/terms') ? 'terms' : 'privacy') ||
      initialTab ||
      'privacy';
    return type === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;
  }, [documentType, location.pathname, initialTab]);

  usePageTitle({
    title: `${activeDoc.title} | TeamApo Hub`,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeDoc.id]);

  return (
    <div className="min-h-dvh bg-surface text-on-surface antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-outline-variant/60 bg-surface/95 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] justify-center"
              aria-label="Return to TeamApo Hub Home"
            >
              <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-medium">Back</span>
            </Link>

            <div className="h-5 w-px bg-outline-variant" aria-hidden="true" />

            <Link to="/" className="flex items-center transition-transform hover:-translate-y-px">
              <img src={apohubTitle} alt="TeamApo Hub" className="h-7 w-auto" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-on-surface mb-10">
          {activeDoc.title}
        </h1>

        <article className="prose prose-slate max-w-none space-y-10 leading-relaxed text-on-surface">
          {activeDoc.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="border-b border-outline-variant/40 pb-8 last:border-b-0"
            >
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface mb-4">
                {section.title}
              </h2>

              <div className="space-y-3.5 text-base text-on-surface leading-relaxed">
                {section.content.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>

              {section.subsections && section.subsections.length > 0 && (
                <div className="mt-6 space-y-6">
                  {section.subsections.map((sub) => (
                    <div key={sub.id} id={sub.id} className="pl-4 border-l-2 border-outline-variant">
                      <h3 className="text-base sm:text-lg font-semibold text-on-surface mb-2">
                        {sub.title}
                      </h3>
                      <div className="space-y-2 text-sm text-on-surface leading-relaxed">
                        {sub.content.map((subP, subIdx) => (
                          <p key={subIdx}>{subP}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
};

export default LegalPage;
