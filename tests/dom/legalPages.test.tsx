import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LegalPage from '@/pages/legal/LegalPage';

describe('LegalPage Standalone Clean Reader DOM Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  const renderLegalPage = (initialRoute = '/privacy') =>
    render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/privacy" element={<LegalPage documentType="privacy" />} />
          <Route path="/terms-of-service" element={<LegalPage documentType="terms" />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders the Privacy Policy directly on /privacy with core sections and legal body', () => {
    renderLegalPage('/privacy');

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '1. Introduction & Legal Basis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '2. Interpretation and Definitions' })).toBeInTheDocument();
    expect(screen.getAllByText(/Republic Act No. 10173/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Terms of Service directly on /terms-of-service without tabs', () => {
    renderLegalPage('/terms-of-service');

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /4\. Event Registration & Ticketing Invariants/i })).toBeInTheDocument();
    expect(screen.getByText(/Single Ticket Per Person:/i)).toBeInTheDocument();
  });

  it('ensures table of contents, tab pills, search bar, brief summaries, print button, and footer are removed', () => {
    renderLegalPage('/privacy');

    // Tab pills are removed
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terms of service/i })).not.toBeInTheDocument();

    // Table of contents is removed
    expect(screen.queryByRole('navigation', { name: /table of contents/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Table of Contents$/i)).not.toBeInTheDocument();

    // Search bar is removed
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();

    // In brief summary is removed
    expect(screen.queryByText(/In Brief:/i)).not.toBeInTheDocument();

    // Print / PDF button is removed
    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument();

    // Meta header removed
    expect(screen.queryByText(/Official Legal Document/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jurisdiction: Republic of the Philippines/i)).not.toBeInTheDocument();

    // Terms subtitle removed
    expect(screen.queryByText(/Terms and conditions governing the use of the TeamApo Hub event lifecycle management platform for Google Developer Groups \(GDG\) Davao\./i)).not.toBeInTheDocument();

    // Footer removed
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByText(/An open-source developer event platform for Davao & Region XI, Philippines\./i)).not.toBeInTheDocument();
  });
});
