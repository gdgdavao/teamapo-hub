import React, { useState, useEffect, useRef } from 'react';
import { 
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon, XCircleIcon as XCircleSolidIcon } from '@heroicons/react/20/solid';
import { doc, updateDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../contexts/AuthContext';
import { Registration as FirestoreRegistration, Event } from '../../types';

interface Registration {
  id: string;
  attendee: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    profilePicture?: string;
  };
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'attended' | 'cancelled';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
}

const AdminCheckInPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [scannedQRCode, setScannedQRCode] = useState('');
  const [checkinResult, setCheckinResult] = useState<{
    success: boolean;
    message: string;
    registration?: Registration;
  } | null>(null);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load registrations and events
  useEffect(() => {
    fetchRegistrations();
    fetchEvents();
  }, []);

  const fetchRegistrations = async () => {
    try {
      const registrationsQuery = query(
        collection(db, 'registrations'),
        where('status', 'in', ['approved', 'paid'])
      );
      
      const snapshot = await getDocs(registrationsQuery);
      const regs: Registration[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data() as FirestoreRegistration;
        // Map Firestore data to local interface
        regs.push({
          id: doc.id,
          attendee: {
            id: data.attendeeId,
            name: data.attendeeName || 'Unknown',
            email: data.attendeeEmail || 'Unknown',
            phone: data.attendeePhone,
            organization: data.attendeeOrganization,
            profilePicture: data.attendeeProfilePicture
          },
          event: {
            id: data.eventId,
            title: data.eventTitle || 'Unknown Event',
            date: data.eventDate || 'Unknown Date',
            venue: data.eventVenue || 'Unknown Venue'
          },
          status: data.registrationStatus || 'pending',
          paymentStatus: data.paymentStatus
        });
      }
      
      setRegistrations(regs);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const eventsQuery = query(
        collection(db, 'events'),
        where('status', '==', 'published')
      );
      
      const snapshot = await getDocs(eventsQuery);
      const eventList: Event[] = [];
      
      snapshot.forEach(doc => {
        eventList.push({ id: doc.id, ...doc.data() } as Event);
      });
      
      setEvents(eventList);
      if (eventList.length > 0) {
        setCurrentEvent(eventList[0]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Camera control functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions and try again.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleQRCodeScan = async (qrCode: string) => {
    if (!qrCode.trim()) return;

    try {
      // Find registration by QR code (assuming QR code contains registration ID)
      const registration = registrations.find(r => r.id === qrCode || r.attendee.email === qrCode);
      
      if (!registration) {
        setCheckinResult({
          success: false,
          message: 'Registration not found. Please check the QR code.'
        });
        return;
      }

      if (registration.status === 'attended') {
        setCheckinResult({
          success: false,
          message: `${registration.attendee.name} has already been checked in.`
        });
        return;
      }

      if (registration.status !== 'approved' && registration.paymentStatus !== 'paid') {
        setCheckinResult({
          success: false,
          message: 'Registration must be approved and payment verified before check-in.'
        });
        return;
      }

      // Update registration status to attended
      const registrationRef = doc(db, 'registrations', registration.id);
      await updateDoc(registrationRef, {
        status: 'attended',
        checkedInAt: serverTimestamp(),
        checkedInBy: userProfile?.uid || 'admin'
      });

      // Update local state
      setRegistrations(prev => prev.map(r => 
        r.id === registration.id ? { ...r, status: 'attended' as const } : r
      ));

      setCheckinResult({
        success: true,
        message: `${registration.attendee.name} has been checked in successfully!`,
        registration
      });

      // Clear QR code input
      setScannedQRCode('');

      // Clear result after 3 seconds
      setTimeout(() => setCheckinResult(null), 3000);

    } catch (error) {
      console.error('Error during check-in:', error);
      setCheckinResult({
        success: false,
        message: 'Failed to check in attendee. Please try again.'
      });
    }
  };

  const handleManualCheckin = async (registrationId: string) => {
    try {
      const registration = registrations.find(r => r.id === registrationId);
      if (!registration) return;

      if (registration.status === 'attended') {
        alert('Attendee already checked in.');
        return;
      }

      if (registration.status !== 'approved' && registration.paymentStatus !== 'paid') {
        alert('Registration must be approved and payment verified before check-in.');
        return;
      }

      const registrationRef = doc(db, 'registrations', registration.id);
      await updateDoc(registrationRef, {
        status: 'attended',
        checkedInAt: serverTimestamp(),
        checkedInBy: userProfile?.uid || 'admin'
      });

      // Update local state
      setRegistrations(prev => prev.map(r => 
        r.id === registrationId ? { ...r, status: 'attended' as const } : r
      ));

      setCheckinResult({
        success: true,
        message: `${registration.attendee.name} has been checked in successfully!`,
        registration
      });

      // Clear result after 3 seconds
      setTimeout(() => setCheckinResult(null), 3000);

    } catch (error) {
      console.error('Error during manual check-in:', error);
      setCheckinResult({
        success: false,
        message: 'Failed to check in attendee. Please try again.'
      });
    }
  };

  // Filter registrations for current event
  const eventRegistrations = currentEvent 
    ? registrations.filter(r => r.event.id === currentEvent.id)
    : registrations;

  const readyForCheckin = eventRegistrations.filter(r => 
    r.status === 'approved' && r.paymentStatus === 'paid'
  );
  
  const checkedIn = eventRegistrations.filter(r => r.status === 'attended');

  if (loading) {
    return (
      <AdminLayout title="Check-In" subtitle="Loading...">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Check-In Station" 
      subtitle="Scan QR codes to check in attendees"
    >
      <div className="space-y-6">
        {/* Event Selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <select
            value={currentEvent?.id || ''}
            onChange={(e) => {
              const event = events.find(ev => ev.id === e.target.value);
              setCurrentEvent(event || null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} - {new Date(event.date).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircleSolidIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-gray-900">{checkedIn.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Ready for Check-in</p>
                <p className="text-2xl font-bold text-gray-900">{readyForCheckin.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Approved</p>
                <p className="text-2xl font-bold text-gray-900">{eventRegistrations.filter(r => r.status === 'approved').length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Scanner */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code Scanner</h3>
            
            {/* Camera Preview */}
            <div className="mb-6">
              <div className="max-w-md mx-auto">
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-64 object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {!isCameraActive && (
                      <div className="text-center">
                        <CameraIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Camera not active</p>
                      </div>
                    )}
                  </div>
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500 rounded-lg">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl-lg"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr-lg"></div>
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl-lg"></div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br-lg"></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  {!isCameraActive ? (
                    <button
                      onClick={startCamera}
                      className="w-full px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      📷 Start Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      🛑 Stop Camera
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Manual Input */}
            <div className="max-w-md mx-auto space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Or enter QR code manually..."
                  value={scannedQRCode}
                  onChange={(e) => setScannedQRCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                  onKeyPress={(e) => e.key === 'Enter' && handleQRCodeScan(scannedQRCode)}
                />
              </div>
              <button
                onClick={() => handleQRCodeScan(scannedQRCode)}
                disabled={!scannedQRCode.trim()}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Check In Attendee
              </button>
            </div>
          </div>
        </div>

        {/* Check-in Result */}
        {checkinResult && (
          <div className={`bg-white rounded-xl border p-6 ${
            checkinResult.success 
              ? 'border-green-200 bg-green-50' 
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${
                checkinResult.success ? 'bg-green-100' : 'bg-red-100'
              } mb-4`}>
                {checkinResult.success ? (
                  <CheckCircleSolidIcon className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircleSolidIcon className="w-6 h-6 text-red-600" />
                )}
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                checkinResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {checkinResult.success ? 'Check-in Successful!' : 'Check-in Failed'}
              </h3>
              <p className={`text-sm ${
                checkinResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {checkinResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Attendees Ready for Check-in */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Attendees Ready for Check-in</h3>
            <span className="text-sm text-gray-500">{readyForCheckin.length} ready</span>
          </div>
          
          {readyForCheckin.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees ready for check-in</h3>
              <p className="mt-1 text-sm text-gray-500">
                All approved and paid attendees have been checked in.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {readyForCheckin.map((registration) => (
                <div key={registration.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {registration.attendee.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{registration.attendee.name}</p>
                      <p className="text-sm text-gray-500">{registration.attendee.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleManualCheckin(registration.id)}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Check In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Checked In */}
        {checkedIn.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Checked In</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {checkedIn.slice(0, 10).map((registration) => (
                <div key={registration.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{registration.attendee.name}</p>
                      <p className="text-sm text-gray-500">{registration.attendee.email}</p>
                    </div>
                  </div>
                  <span className="text-sm text-green-600 font-medium">✓ Checked In</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCheckInPage;
