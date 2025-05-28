import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  UserGroupIcon, 
  AcademicCapIcon,
  CreditCardIcon,
  BellIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: CalendarDaysIcon,
      title: 'Event Management',
      description: 'Create, manage, and promote GDG Davao events with ease. Set up venues, speakers, and ticket types.',
    },
    {
      icon: UserGroupIcon,
      title: 'Attendee Registration',
      description: 'Streamlined registration process with user-friendly forms and instant confirmations.',
    },
    {
      icon: CreditCardIcon,
      title: 'Payment Processing',
      description: 'Secure payment integration with Paymongo for QRPH and other local payment methods.',
    },
    {
      icon: BellIcon,
      title: 'Smart Notifications',
      description: 'Automated email notifications for registrations, reminders, and post-event feedback.',
    },
    {
      icon: AcademicCapIcon,
      title: 'Digital Certificates',
      description: 'Generate verifiable certificates with unique credential IDs for event participants.',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Attendance Tracking',
      description: 'QR code-based check-in system for accurate attendance tracking and analytics.',
    },
  ];

  const stats = [
    { label: 'Events Managed', value: '100+' },
    { label: 'Developers Reached', value: '5K+' },
    { label: 'Certificates Issued', value: '3K+' },
    { label: 'Success Rate', value: '99%' },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-gdg overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in">
              Welcome to <span className="text-accent-400">APOHUB</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-100 mb-8 max-w-3xl mx-auto animate-slide-in">
              The complete event management platform for Google Developer Group Davao. 
              Streamline your tech events from registration to certification.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-bounce-in">
              <Link to="/events" className="btn-secondary bg-white text-primary-600 hover:bg-gray-50">
                Browse Events
              </Link>
              <Link to="/signup" className="btn-primary bg-accent-500 hover:bg-accent-600">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything you need for successful events
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From event creation to post-event analytics, APOHUB provides all the tools 
              GDG Davao needs to run professional tech events.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="card hover-lift p-8 text-center group"
              >
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary-200 transition-colors">
                  <feature.icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to elevate your events?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join the Google Developer Group Davao community and start creating 
            memorable tech experiences with APOHUB.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="btn-primary bg-primary-600 hover:bg-primary-700">
              Create Account
            </Link>
            <Link to="/events" className="btn-secondary text-white border-white hover:bg-white hover:text-gray-900">
              View Events
            </Link>
          </div>
        </div>
      </section>

      {/* About GDG Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                About GDG Davao
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Google Developer Group Davao is a community of passionate developers, 
                designers, and tech enthusiasts in Davao City. We organize regular meetups, 
                workshops, and conferences to share knowledge and build connections in the tech community.
              </p>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                APOHUB was created specifically to streamline our event management process 
                and provide a better experience for our community members.
              </p>
              <a 
                href="https://gdg.community.dev/gdg-davao/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Visit GDG Davao
              </a>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-google rounded-2xl p-8 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl font-bold bg-gradient-google bg-clip-text text-transparent">
                      GDG
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Davao Chapter</h3>
                  <p className="text-lg opacity-90">Building the future together</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 