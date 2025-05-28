import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-google rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">APOHUB</h3>
                <p className="text-sm text-gray-500">GDG Davao Event Management</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4 max-w-md">
              Streamlining event management for Google Developer Group Davao. 
              From registration to certificates, we make tech events seamless.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://gdg.community.dev/gdg-davao/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-primary-600 transition-colors"
              >
                GDG Community
              </a>
              <a
                href="https://developers.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-primary-600 transition-colors"
              >
                Google Developers
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/events" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Browse Events
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/my/events" className="text-gray-600 hover:text-primary-600 transition-colors">
                  My Events
                </Link>
              </li>
              <li>
                <Link to="/my/certificates" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Certificates
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <a href="mailto:gdgdavao@example.com" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <Link to="/help" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} APOHUB. Built for GDG Davao with ❤️
          </p>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <span className="text-xs text-gray-400">Powered by</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-600">Firebase</span>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-medium text-gray-600">React</span>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-medium text-gray-600">Paymongo</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 