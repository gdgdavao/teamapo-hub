import React from 'react';
import { Outlet } from 'react-router-dom';
import { isMainDomain } from '../../../utils/subdomain';
import Header from './Header';
import Footer from './Footer';
import DevCredentialsInfo from '../../shared/DevCredentialsInfo';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {/* Development credentials info */}
      <DevCredentialsInfo />
    </div>
  );
};

export default Layout; 