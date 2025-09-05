import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { EventService } from '../../../services/eventService';
import { RegistrationService } from '../../../services/registrationService';
import TicketSelector, { TicketSelection } from '../TicketSelector';
import { Event, FormField } from '../../../types';
import toast from 'react-hot-toast';

interface RegistrationFormProps {
  event: Event;
  registrationForm: FormField[];
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ event, registrationForm }) => {
  const navigate = useNavigate();
  const [ticketSelection, setTicketSelection] = useState<TicketSelection | null>(null);
  const [registrationData, setRegistrationData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    customResponses: {} as Record<string, any>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!event || !ticketSelection) {
      toast.error('Please select a ticket type');
      return;
    }

    // Check if using custom form fields or fallback form
    if (registrationForm.length > 0) {
      // Validate custom form fields
      const requiredFields = registrationForm.filter(field => field.required);
      const missingFields = requiredFields.filter(field => 
        !registrationData.customResponses[field.id] || 
        registrationData.customResponses[field.id].trim() === ''
      );
      
      if (missingFields.length > 0) {
        toast.error('Please fill in all required fields');
        return;
      }
    } else {
      // Validate fallback form fields
      if (!registrationData.name || !registrationData.email) {
        toast.error('Please fill in all required fields');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      
      // Prepare user details based on form type
      let userDetails;
      if (registrationForm.length > 0) {
        // Extract name and email from custom responses if they exist
        const nameField = registrationForm.find(field => 
          field.label.toLowerCase().includes('name') || 
          field.id.toLowerCase().includes('name')
        );
        const emailField = registrationForm.find(field => 
          field.label.toLowerCase().includes('email') || 
          field.id.toLowerCase().includes('email')
        );
        
        userDetails = {
          name: nameField ? registrationData.customResponses[nameField.id] : '',
          email: emailField ? registrationData.customResponses[emailField.id] : '',
          phoneNumber: registrationData.phone,
          organization: registrationData.organization
        };
      } else {
        // Use fallback form data
        userDetails = {
          name: registrationData.name,
          email: registrationData.email,
          phoneNumber: registrationData.phone,
          organization: registrationData.organization
        };
      }

      const registrationPayload = {
        eventId: event.id,
        ticketTypeId: ticketSelection.ticketTypeId,
        quantity: ticketSelection.quantity,
        promoCode: ticketSelection.promoCode,
        userDetails,
        customResponses: registrationData.customResponses,
        agreeToTerms: true,
        subscribeToUpdates: false
      };

      // Create a pending registration (not yet confirmed)
      const registration = await RegistrationService.createPendingRegistration(registrationPayload);
      
      toast.success('Registration details saved! Please proceed to payment.');
      
      // Always navigate to payment page first
      navigate(`/payment/${registration.registrationId}`);
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ticket Selection */}
      {event.ticketTypes && event.ticketTypes.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="w-1 h-5 bg-red-500 rounded-full mr-2"></div>
            Choose Your Ticket
          </h2>
          <TicketSelector
            ticketTypes={event.ticketTypes}
            promoCodes={event.promoCodes || []}
            onSelectionChange={setTicketSelection}
          />
        </div>
      )}

      {/* Registration Form */}
      {ticketSelection && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <div className="w-1 h-5 bg-green-500 rounded-full mr-2"></div>
            Registration Details
          </h2>
          <form onSubmit={handleRegistrationSubmit} className="space-y-4">
            {/* Dynamic Form Fields from Event Configuration */}
            {registrationForm.length > 0 ? (
              <div className="space-y-4">
                {registrationForm.map((field) => (
                  <div key={field.id} className={field.gridSize === 'half' ? 'md:w-1/2' : 'w-full'}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={registrationData.customResponses[field.id] || ''}
                        onChange={(e) => setRegistrationData(prev => ({
                          ...prev,
                          customResponses: { ...prev.customResponses, [field.id]: e.target.value }
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        rows={3}
                        required={field.required}
                        placeholder={`Enter your ${field.label.toLowerCase()}`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={registrationData.customResponses[field.id] || ''}
                        onChange={(e) => setRegistrationData(prev => ({
                          ...prev,
                          customResponses: { ...prev.customResponses, [field.id]: e.target.value }
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required={field.required}
                      >
                        <option value="">Select an option</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={registrationData.customResponses[field.id] || ''}
                        onChange={(e) => setRegistrationData(prev => ({
                          ...prev,
                          customResponses: { ...prev.customResponses, [field.id]: e.target.value }
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required={field.required}
                        placeholder={`Enter your ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback to basic form if no custom form is configured */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={registrationData.name}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={registrationData.email}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                    placeholder="Enter your email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={registrationData.phone}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={registrationData.organization}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, organization: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your organization"
                  />
                </div>
              </div>
            )}

            {/* Total Amount */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₱{ticketSelection.totalAmount.toLocaleString()}
                </span>
              </div>
              {ticketSelection.discountAmount > 0 && (
                <div className="mt-2 text-sm text-green-600 font-medium">
                  You saved ₱{ticketSelection.discountAmount.toLocaleString()}!
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                'Proceed to Payment'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default RegistrationForm;
