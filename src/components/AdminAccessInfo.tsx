import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminUrl } from '../utils/subdomain';
import { ExclamationTriangleIcon, UserPlusIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

const AdminAccessInfo: React.FC = () => {
  const { currentUser, userProfile, refreshUserProfile } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [updating, setUpdating] = useState(false);

  const makeCurrentUserAdmin = async () => {
    if (!currentUser || !userProfile) {
      toast.error('No user logged in');
      return;
    }

    try {
      setUpdating(true);
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { role: 'admin' });
      await refreshUserProfile();
      toast.success('User role updated to admin!');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setUpdating(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 mb-1">Not Signed In</h3>
            <p className="text-sm text-red-700">
              You need to sign in to access the admin dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800 mb-1">Profile Loading</h3>
            <p className="text-sm text-yellow-700">
              User profile is still loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (userProfile.role !== 'admin') {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-orange-800 mb-2">Admin Access Required</h3>
            <p className="text-sm text-orange-700 mb-3">
              Your current role is <span className="font-medium">'{userProfile.role}'</span>. 
              Admin access is required to view the dashboard.
            </p>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                {showDetails ? (
                  <>
                    <EyeSlashIcon className="w-4 h-4 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <EyeIcon className="w-4 h-4 mr-1" />
                    Show Details
                  </>
                )}
              </button>
              
              <button
                onClick={makeCurrentUserAdmin}
                disabled={updating}
                className="inline-flex items-center px-3 py-1.5 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50 font-medium"
              >
                <UserPlusIcon className="w-4 h-4 mr-1" />
                {updating ? 'Updating...' : 'Make Me Admin'}
              </button>
            </div>

            {showDetails && (
              <div className="mt-4 p-3 bg-white rounded-md border border-orange-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Debug Information:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>User ID:</strong> {currentUser.uid}</div>
                  <div><strong>Email:</strong> {currentUser.email}</div>
                  <div><strong>Display Name:</strong> {userProfile.displayName}</div>
                  <div><strong>Current Role:</strong> {userProfile.role}</div>
                  <div><strong>Profile Created:</strong> {userProfile.createdAt ? 'Yes' : 'No'}</div>
                </div>
                
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                  <strong>To manually fix this:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Go to Firebase Console → Firestore Database</li>
                    <li>Navigate to users/{currentUser.uid}</li>
                    <li>Change the 'role' field from '{userProfile.role}' to 'admin'</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <div className="w-6 h-6 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-green-800 mb-1">Admin Access Verified</h3>
          <p className="text-sm text-green-700">
            Welcome, {userProfile.displayName}! You have admin access to the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminAccessInfo;
