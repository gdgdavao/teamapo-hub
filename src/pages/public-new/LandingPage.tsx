import React from 'react';
import { FaFacebook, FaInstagram, FaLinkedin, FaGithub } from 'react-icons/fa';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4 sm:px-6 lg:px-8">
        {/* GDG Davao Logo */}
        <div className="mb-12">
          <div className="inline-flex items-center justify-center">
            <img 
              src="/src/assets/gdgdvo.svg" 
              alt="GDG Davao" 
              className="h-32 w-auto"
            />
          </div>
        </div>

        {/* Coming Soon Text */}
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8">
          Coming Soon
        </h1>

        {/* Social Media Links */}
        <div className="flex justify-center space-x-6">
          <a 
            href="https://www.facebook.com/gdgdavao" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-600 transition-colors duration-200"
            aria-label="Facebook"
          >
            <FaFacebook className="w-6 h-6" />
          </a>
          
          <a 
            href="https://www.instagram.com/gdgdavao" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-pink-600 transition-colors duration-200"
            aria-label="Instagram"
          >
            <FaInstagram className="w-6 h-6" />
          </a>
          
          <a 
            href="https://www.linkedin.com/company/gdg-davao" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-700 transition-colors duration-200"
            aria-label="LinkedIn"
          >
            <FaLinkedin className="w-6 h-6" />
          </a>
          
          <a 
            href="https://github.com/gdgdavao" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-900 transition-colors duration-200"
            aria-label="GitHub"
          >
            <FaGithub className="w-6 h-6" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 