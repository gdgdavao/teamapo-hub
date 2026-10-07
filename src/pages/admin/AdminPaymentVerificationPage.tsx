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
import { useSearchParams } from 'react-router-dom';
import { PaymentService, PaymentVerificationData } from '../../services/paymentService';
import { useAuth } from '../../contexts/AuthContext';
import DashboardShell from '../../components/shared/DashboardShell';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import { Button, Modal } from '../../components/shared/UI';

interface AdminPaymentVerificationPageProps {
  embedded?: boolean;
  propEventId?: string;
}

const AdminPaymentVerificationPage: React.FC<AdminPaymentVerificationPageProps> = ({
  embedded = false,
  propEventId
}) => {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const eventId = propEventId || searchParams.get('eventId');
  const LayoutComponent = DashboardShell;
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
        const proofsData = eventId 
          ? await PaymentService.getPaymentProofsByEvent(eventId)
          : await PaymentService.getAllPaymentProofs();
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
  }, [eventId]);

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
      const updatedProofs = eventId
        ? await PaymentService.getPaymentProofsByEvent(eventId)
        : await PaymentService.getAllPaymentProofs();
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
        return <CheckCircleIcon className="w-5 h-5 text-success" />;
      case 'rejected':
        return <XCircleIcon className="w-5 h-5 text-error" />;
      default:
        return <ClockIcon className="w-5 h-5 text-warning" />;
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
    if (embedded) {
      return (
        <div className="py-8 text-center">
          <div className="motion-essential animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-on-surface-variant mt-4">Loading payment verifications...</p>
        </div>
      );
    }
    return (
      <LayoutComponent>
        <div className="py-lg">
          <div className="text-center">
            <div className="motion-essential animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-on-surface-variant mt-4">Loading payment verifications...</p>
          </div>
        </div>
      </LayoutComponent>
    );
  }

  const paymentContent = (
    <div className="space-y-6">
      {/*
        No header block. There is only one shell, DashboardShell,
        which already emits the page <h1> from the route. This page used to
        render a second <h1> below it. The descriptive line moved to the
        shell's `subtitle` prop on the LayoutComponent below, so it is no
        longer hidden behind `!embedded`.
      */}

      {/* Filters and Revenue Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex space-x-1 bg-surface-container p-1 rounded-lg w-fit" role="tablist" aria-label="Filter payments by status">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => {
            const count = status === 'all' 
              ? paymentProofs.length 
              : paymentProofs.filter(p => p.verificationStatus === status).length;
            return (
              <button
                key={status}
                role="tab"
                aria-selected={filter === status}
                onClick={() => setFilter(status)}
                className={`inline-flex min-h-[44px] items-center px-4 py-2 rounded-md text-sm font-medium capitalize active:scale-[0.97] transition-[color,background-color,transform] duration-short2 ease-emphasized-standard focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  filter === status
                    ? 'bg-white text-on-surface shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>{status}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold transition-colors duration-fast ease-quart ${
                  filter === status ? 'bg-primary-container text-primary animate-pop-in motion-reduce:animate-none' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-success-container border border-outline-variant rounded-lg self-start sm:self-auto">
          <CurrencyDollarIcon className="w-5 h-5 text-success" />
          <div className="text-sm">
            <span className="text-success font-medium">Verified Revenue: </span>
            <span className="font-bold text-on-success-container">
              ₱{paymentProofs.filter(p => p.verificationStatus === 'approved').reduce((sum, p) => sum + p.ticketPrice, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Proofs List */}
      <div className="bg-white rounded-lg border border-outline-variant overflow-hidden">
        {filteredProofs.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="w-12 h-12 text-outline-variant mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">No payment proofs found</h3>
            <p className="text-on-surface-variant">
              {filter === 'all' 
                ? 'No payment proofs have been submitted yet.'
                : `No ${filter} payment proofs found.`
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-outline-variant">
                {filteredProofs.map((proof) => (
                  <tr key={proof.id} className="hover:bg-surface-container-low transition-colors duration-fast ease-quart">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-on-surface">{proof.attendeeName}</div>
                        <div className="text-sm text-on-surface-variant">{proof.attendeeEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-on-surface">{proof.eventTitle}</div>
                        <div className="text-sm text-on-surface-variant">{new Date(proof.eventDate).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      ₱{proof.ticketPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {proof.transactionId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      {new Date(proof.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proof.verificationStatus)}`}>
                        {getStatusIcon(proof.verificationStatus)}
                        <span className="ml-1 capitalize">{proof.verificationStatus}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      <button
                        onClick={() => setSelectedProof(proof)}
                        className="inline-flex min-h-[40px] items-center text-primary hover:text-on-secondary-container active:scale-[0.97] transition-[color,transform] duration-short2 ease-emphasized-standard font-medium"
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
        <Modal
          open={!!selectedProof}
          onClose={() => setSelectedProof(null)}
          title="Payment Verification"
          size="lg"
          footer={
            selectedProof.verificationStatus === 'pending' ? (
              <>
                <Button
                  variant="tonal"
                  icon={<CheckCircleIcon className="h-5 w-5" />}
                  onClick={() => handleVerification(selectedProof.id, 'approved')}
                >
                  Approve Payment
                </Button>
                <Button
                  variant="danger"
                  icon={<XCircleIcon className="h-5 w-5" />}
                  onClick={() => handleVerification(selectedProof.id, 'rejected')}
                >
                  Reject Payment
                </Button>
                <Button variant="outlined" onClick={() => setSelectedProof(null)}>
                  Cancel
                </Button>
              </>
            ) : null
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Payment Details */}
                <div>
                  <h3 className="text-lg font-medium text-on-surface mb-4">Payment Details</h3>
                  <div className="space-y-4">
                    <div className="bg-surface-container-low rounded-lg p-4">
                      <div className="grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-on-surface-variant">Attendee:</span>
                          <div className="text-on-surface">{selectedProof.attendeeName}</div>
                          <div className="text-on-surface-variant">{selectedProof.attendeeEmail}</div>
                        </div>
                        <div>
                          <span className="font-medium text-on-surface-variant">Event:</span>
                          <div className="text-on-surface">{selectedProof.eventTitle}</div>
                          <div className="text-on-surface-variant">{new Date(selectedProof.eventDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-on-surface-variant">Amount:</span>
                          <div className="text-lg font-semibold text-success">₱{selectedProof.ticketPrice.toLocaleString()}</div>
                        </div>
                        <div>
                          <span className="font-medium text-on-surface-variant">Transaction ID:</span>
                          <div className="text-on-surface font-mono">{selectedProof.transactionId || 'Not provided'}</div>
                        </div>
                        <div>
                          <span className="font-medium text-on-surface-variant">Submitted:</span>
                          <div className="text-on-surface">{new Date(selectedProof.submittedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="bg-surface-container-low rounded-lg p-4">
                      <h4 className="font-medium text-on-surface-variant mb-2">Current Status</h4>
                      <div className="flex items-center">
                        {getStatusIcon(selectedProof.verificationStatus)}
                        <span className="ml-2 capitalize font-medium">{selectedProof.verificationStatus}</span>
                      </div>
                      {selectedProof.verificationStatus !== 'pending' && (
                        <div className="mt-2 text-sm text-on-surface-variant">
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
                  <h3 className="text-lg font-medium text-on-surface mb-4">Payment Proof</h3>
                  {selectedProof.proofImageUrl ? (
                    <div className="bg-surface-container-low rounded-lg p-4">
                      <img
                        src={selectedProof.proofImageUrl}
                        alt="Payment Proof"
                        className="w-full max-w-md mx-auto rounded border border-outline-variant"
                      />
                    </div>
                  ) : (
                    <div className="bg-surface-container-low rounded-lg p-8 text-center">
                      <PhotoIcon className="w-12 h-12 text-on-surface-variant mx-auto mb-2" />
                      <p className="text-on-surface-variant">No payment proof image provided</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Actions */}
              {selectedProof.verificationStatus === 'pending' && (
                <div className="mt-8 border-t border-outline-variant pt-6">
                  <h3 className="text-lg font-medium text-on-surface mb-4">Verification Decision</h3>

                  <label className="block text-sm font-medium text-on-surface-variant mb-2" htmlFor="verification-notes">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="verification-notes"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Add any notes about this verification..."
                    rows={3}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}
        </Modal>
      )}
    </div>
  );

  if (embedded) {
    return paymentContent;
  }

  return (
    <LayoutComponent subtitle="Review and verify payment proofs from attendees">
      {paymentContent}
    </LayoutComponent>
  );
};

export default AdminPaymentVerificationPage;
