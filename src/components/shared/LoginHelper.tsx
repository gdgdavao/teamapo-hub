import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const LoginHelper: React.FC = () => {
  const { signIn } = useAuth();

  const handleQuickLogin = async (email: string, password: string) => {
    try {
      await signIn(email, password);
    } catch (error) {
      console.error('Quick login failed:', error);
    }
  };

  const sampleUsers = [
    {
      email: 'admin@gdgdavao.org',
      role: 'Admin',
      description: 'Full access to admin panel'
    },
    {
      email: 'organizer@gdgdavao.org',
      role: 'Organizer',
      description: 'Can create and manage events'
    }
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-medium text-blue-900 mb-3">
        Quick Login (Development)
      </h3>
      <p className="text-xs text-blue-700 mb-3">
        Password for all accounts: <code className="bg-blue-100 px-1 rounded">password123</code>
      </p>
      <div className="space-y-2">
        {sampleUsers.map((user, index) => (
          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{user.email}</div>
              <div className="text-xs text-gray-600">{user.role} - {user.description}</div>
            </div>
            <button
              onClick={() => handleQuickLogin(user.email, 'password123')}
              className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Login
            </button>
          </div>
        ))}
      </div>
      
      <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
        <div className="text-xs text-green-700">
          <strong>Note:</strong> Attendees don't need accounts - they can register for events anonymously using just their email address.
        </div>
      </div>
    </div>
  );
};

export default LoginHelper;
