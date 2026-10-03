import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  PhotoIcon,
  ClockIcon,
  EyeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { PaymentService, PaymentVerificationData } from '../../services/paymentService';
import { useAuth } from '../../contexts/AuthContext';
import AdminLayout from '../../components/admin/AdminLayout';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

const AdminPaymentVerificationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [paymentProofs, setPaymentProofs] = useState<PaymentVerificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedProof, setSelectedProof] = useState<PaymentVerificationData | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Load payment proofs from API
  useEffect(() => {
    const fetchPaymentProofs = async () => {
      try {
        setLoading(true);
        const proofsData = await PaymentService.getAllPaymentProofs();
        setPaymentProofs(proofsData);
      } catch (error) {
        logger.error('Error fetching payment proofs:', error);
        toast.error('Failed to load payment proofs');
        setPaymentProofs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentProofs();
  }, []);

  const handleVerification = async (proofId: string, status: 'approved' | 'rejected') => {
    if (!currentUser) {
      toast.error('You must be logged in to verify payments');
      return;
    }

    const proof = paymentProofs.find(p => p.id === proofId);
    if (!proof) return;

    try {
      await PaymentService.verifyPaymentProof(
        proofId,
        status,
        currentUser.uid,
        currentUser.displayName || 'Admin User',
        verificationNotes
      );

      // Refresh payment proofs list
      const updatedProofs = await PaymentService.getAllPaymentProofs();
      setPaymentProofs(updatedProofs);
      
      toast.success(`Payment ${status} successfully`);
      setSelectedProof(null);
      setVerificationNotes('');
    } catch (error) {
      logger.error('Error verifying payment:', error);
      toast.error('Failed to verify payment');
    }
  };

  const filteredProofs = paymentProofs.filter(proof => {
    if (filter === 'all') return true;
    return proof.verificationStatus === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading payment verifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Payment Verification</h1>
        <p className="text-gray-600 mt-2">Review and verify payment proofs from attendees</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <ClockIcon className="w-8 h-8 text-yellow-500" />
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">
                {paymentProofs.filter(p => p.verificationStatus === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">
                {paymentProofs.filter(p => p.verificationStatus === 'approved').length}
              </div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <XCircleIcon className="w-8 h-8 text-red-500" />
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">
                {paymentProofs.filter(p => p.verificationStatus === 'rejected').length}
              </div>
              <div className="text-sm text-gray-600">Rejected</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="w-8 h-8 text-blue-500" />
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">
                ₱{paymentProofs.filter(p => p.verificationStatus === 'approved').reduce((sum, p) => sum + p.ticketPrice, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                filter === status
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status}
              {status !== 'all' && (
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                  {paymentProofs.filter(p => p.verificationStatus === status).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Proofs List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredProofs.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payment proofs found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'No payment proofs have been submitted yet.'
                : `No ${filter} payment proofs found.`
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProofs.map((proof) => (
                  <tr key={proof.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{proof.attendeeName}</div>
                        <div className="text-sm text-gray-500">{proof.attendeeEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{proof.eventTitle}</div>
                        <div className="text-sm text-gray-500">{new Date(proof.eventDate).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₱{proof.ticketPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {proof.transactionId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(proof.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proof.verificationStatus)}`}>
                        {getStatusIcon(proof.verificationStatus)}
                        <span className="ml-1 capitalize">{proof.verificationStatus}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedProof(proof)}
                        className="flex items-center text-blue-600 hover:text-blue-900"
                      >
                        <EyeIcon className="w-4 h-4 mr-1" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Proof Modal */}
      {selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Payment Verification</h2>
                <button
                  onClick={() => setSelectedProof(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Payment Details */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Details</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Attendee:</span>
                          <div className="text-gray-900">{selectedProof.attendeeName}</div>
                          <div className="text-gray-500">{selectedProof.attendeeEmail}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Event:</span>
                          <div className="text-gray-900">{selectedProof.eventTitle}</div>
                          <div className="text-gray-500">{new Date(selectedProof.eventDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Amount:</span>
                          <div className="text-lg font-semibold text-green-600">₱{selectedProof.ticketPrice.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Transaction ID:</span>
                          <div className="text-gray-900 font-mono">{selectedProof.transactionId || 'Not provided'}</div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Submitted:</span>
                          <div className="text-gray-900">{new Date(selectedProof.submittedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-700 mb-2">Current Status</h4>
                      <div className="flex items-center">
                        {getStatusIcon(selectedProof.verificationStatus)}
                        <span className="ml-2 capitalize font-medium">{selectedProof.verificationStatus}</span>
                      </div>
                      {selectedProof.verificationStatus !== 'pending' && (
                        <div className="mt-2 text-sm text-gray-600">
                          <div>Verified by: {selectedProof.verifiedBy}</div>
                          <div>Date: {selectedProof.verifiedAt && new Date(selectedProof.verifiedAt).toLocaleString()}</div>
                          {selectedProof.notes && (
                            <div className="mt-1">
                              <span className="font-medium">Notes:</span> {selectedProof.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Proof Image */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Proof</h3>
                  {selectedProof.proofImageUrl ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <img
                        src={selectedProof.proofImageUrl}
                        alt="Payment Proof"
                        className="w-full max-w-md mx-auto rounded border border-gray-200"
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                      <PhotoIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No payment proof image provided</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Actions */}
              {selectedProof.verificationStatus === 'pending' && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Verification Decision</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Add any notes about this verification..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleVerification(selectedProof.id, 'approved')}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircleIcon className="w-4 h-4 mr-2" />
                      Approve Payment
                    </button>
                    <button
                      onClick={() => handleVerification(selectedProof.id, 'rejected')}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircleIcon className="w-4 h-4 mr-2" />
                      Reject Payment
                    </button>
                    <button
                      onClick={() => setSelectedProof(null)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentVerificationPage;
