import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  EnvelopeIcon, 
  CalendarIcon,
  UserIcon,
  TicketIcon
} from '@heroicons/react/24/outline';

const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
          <CheckCircleIcon className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Proof Submitted</h1>
        <p className="text-gray-600 text-lg">Your registration is pending manual verification by our team.</p>
      </div>

      {/* Success Details */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
          <TicketIcon className="h-6 w-6 text-blue-500 mr-2" />
          What Happens Next?
        </h2>
        
        <div className="space-y-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                <span className="text-sm font-semibold text-blue-600">1</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manual Review</h3>
              <p className="text-gray-600">An admin will review your payment proof shortly.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                <span className="text-sm font-semibold text-blue-600">2</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Email Notification</h3>
              <p className="text-gray-600">You'll receive an email once your payment is approved or if we need more info.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                <span className="text-sm font-semibold text-blue-600">3</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Next Steps</h3>
              <p className="text-gray-600">After approval, you'll receive your confirmation and QR code for check-in.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Important Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
          <EnvelopeIcon className="h-5 w-5 mr-2" />
          Important Information
        </h3>
        <ul className="space-y-2 text-blue-800">
          <li>• Check your email (including spam folder) for verification updates</li>
          <li>• Keep your registration ID safe - you may need it for support</li>
          <li>• If you don't receive an update within 1-2 business days, contact support</li>
          <li>• Your payment proof is securely stored for our records</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
        >
          Back to Home
        </button>
        <button
          onClick={() => navigate('/events')}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
        >
          Browse More Events
        </button>
      </div>

      {/* Support Information */}
      <div className="mt-12 text-center">
        <p className="text-gray-500 text-sm">
          Need help? Contact our support team at{' '}
          <a href="mailto:support@apohub.com" className="text-blue-600 hover:text-blue-700">
            support@apohub.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 