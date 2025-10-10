import React, { useState, useEffect } from 'react';
import { XMarkIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { Event, TicketType, FormField } from '../../../types';
import { EventService } from '../../../services/eventService';
import toast from 'react-hot-toast';

interface WalkInRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  onSubmit: (data: WalkInRegistrationData) => Promise<void>;
}

export interface WalkInRegistrationData {
  name: string;
  email: string;
  phoneNumber?: string;
  organization?: string;
  ticketTypeId: string;
  quantity: number;
  paymentStatus: 'paid' | 'pending';
  paymentMethod?: 'cash' | 'gcash' | 'bank-transfer' | 'other';
  paymentReference?: string;
  notes?: string;
  customFormData?: Record<string, any>; // Additional fields from registration form
}

const WalkInRegistrationModal: React.FC<WalkInRegistrationModalProps> = ({
  isOpen,
  onClose,
  event,
  onSubmit
}) => {
  const [formData, setFormData] = useState<WalkInRegistrationData>({
    name: '',
    email: '',
    phoneNumber: '',
    organization: '',
    ticketTypeId: '',
    quantity: 1,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    paymentReference: '',
    notes: '',
    customFormData: {}
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [registrationForm, setRegistrationForm] = useState<FormField[]>([]);
  const [loadingForm, setLoadingForm] = useState(true);

  useEffect(() => {
    if (isOpen && event.ticketTypes.length > 0) {
      // Pre-select first active ticket type
      const firstActiveTicket = event.ticketTypes.find(t => t.isActive);
      if (firstActiveTicket) {
        setFormData(prev => ({ ...prev, ticketTypeId: firstActiveTicket.id }));
        setSelectedTicket(firstActiveTicket);
      }
    }
  }, [isOpen, event]);

  // Load registration form
  useEffect(() => {
    const loadRegistrationForm = async () => {
      if (!isOpen || !event.id) return;
      
      try {
        setLoadingForm(true);
        const form = await EventService.getEventRegistrationForm(event.id);
        setRegistrationForm(form);
        
        // Initialize custom form data with empty values
        const initialCustomData: Record<string, any> = {};
        form.forEach(field => {
          if (field.type === 'checkbox') {
            initialCustomData[field.id] = false;
          } else if (field.type === 'multiselect') {
            initialCustomData[field.id] = [];
          } else {
            initialCustomData[field.id] = '';
          }
        });
        setFormData(prev => ({ ...prev, customFormData: initialCustomData }));
      } catch (error) {
        console.error('Failed to load registration form:', error);
        toast.error('Failed to load registration form');
      } finally {
        setLoadingForm(false);
      }
    };

    loadRegistrationForm();
  }, [isOpen, event.id]);

  useEffect(() => {
    // Update selected ticket when ticketTypeId changes
    if (formData.ticketTypeId) {
      const ticket = event.ticketTypes.find(t => t.id === formData.ticketTypeId);
      setSelectedTicket(ticket || null);
    }
  }, [formData.ticketTypeId, event.ticketTypes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      customFormData: {
        ...prev.customFormData,
        [fieldId]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate ticket selection
    if (!formData.ticketTypeId) {
      toast.error('Please select a ticket type');
      return;
    }
    if (formData.quantity < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    // Validate custom form fields
    for (const field of registrationForm) {
      if (field.required) {
        const value = formData.customFormData?.[field.id];
        
        if (!value || (typeof value === 'string' && !value.trim())) {
          toast.error(`${field.label} is required`);
          return;
        }

        // Email validation
        if (field.type === 'email' && typeof value === 'string' && !value.includes('@')) {
          toast.error(`Please enter a valid email for ${field.label}`);
          return;
        }

        // Phone validation (basic)
        if (field.type === 'phone' && typeof value === 'string' && value.trim() && value.length < 10) {
          toast.error(`Please enter a valid phone number for ${field.label}`);
          return;
        }
      }
    }

    // Check ticket availability
    if (selectedTicket) {
      const available = selectedTicket.maxQuantity 
        ? selectedTicket.maxQuantity - selectedTicket.currentSold 
        : Infinity;
      
      if (formData.quantity > available) {
        toast.error(`Only ${available} tickets available for ${selectedTicket.name}`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      
      // Reset form
      const initialCustomData: Record<string, any> = {};
      registrationForm.forEach(field => {
        if (field.type === 'checkbox') {
          initialCustomData[field.id] = false;
        } else if (field.type === 'multiselect') {
          initialCustomData[field.id] = [];
        } else {
          initialCustomData[field.id] = '';
        }
      });

      setFormData({
        name: '',
        email: '',
        phoneNumber: '',
        organization: '',
        ticketTypeId: event.ticketTypes.find(t => t.isActive)?.id || '',
        quantity: 1,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        paymentReference: '',
        notes: '',
        customFormData: initialCustomData
      });
      
      onClose();
      toast.success('Walk-in registration completed successfully!');
    } catch (error: any) {
      console.error('Walk-in registration error:', error);
      toast.error(error.message || 'Failed to register walk-in attendee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedTicket) return 0;
    return selectedTicket.price * formData.quantity;
  };

  // Render dynamic form field
  const renderFormField = (field: FormField) => {
    const value = formData.customFormData?.[field.id] || '';
    const gridClass = field.gridSize === 'full' ? 'md:col-span-2' : '';

    const commonInputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-1">{field.description}</p>
            )}
            <input
              type={field.type === 'phone' ? 'tel' : field.type}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={commonInputClass}
              placeholder={field.placeholder}
              required={field.required}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-1">{field.description}</p>
            )}
            <textarea
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={commonInputClass}
              placeholder={field.placeholder}
              rows={3}
              required={field.required}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-1">{field.description}</p>
            )}
            <select
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={commonInputClass}
              required={field.required}
            >
              <option value="">Select an option</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-2">{field.description}</p>
            )}
            <div className="space-y-2">
              {field.options?.map((option) => (
                <label key={option} className="flex items-center">
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={value === option}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    className="mr-2"
                    required={field.required}
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className={gridClass}>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleCustomFieldChange(field.id, e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                required={field.required}
              />
              <span className="text-sm text-gray-700">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </span>
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mt-1 ml-6">{field.description}</p>
            )}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-2">{field.description}</p>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
              {field.options?.map((option) => (
                <label key={option} className="flex items-center">
                  <input
                    type="checkbox"
                    value={option}
                    checked={Array.isArray(value) && value.includes(option)}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      const newValues = e.target.checked
                        ? [...currentValues, option]
                        : currentValues.filter(v => v !== option);
                      handleCustomFieldChange(field.id, newValues);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-1">{field.description}</p>
            )}
            <input
              type="date"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              className={commonInputClass}
              required={field.required}
            />
          </div>
        );

      case 'rating':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-2">{field.description}</p>
            )}
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleCustomFieldChange(field.id, rating)}
                  className={`w-10 h-10 rounded-full border-2 ${
                    value === rating
                      ? 'bg-yellow-400 border-yellow-500 text-white'
                      : 'border-gray-300 text-gray-400 hover:border-yellow-400'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        );

      case 'file':
        return (
          <div key={field.id} className={gridClass}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.description && (
              <p className="text-xs text-gray-500 mb-1">{field.description}</p>
            )}
            <input
              type="file"
              onChange={(e) => handleCustomFieldChange(field.id, e.target.files?.[0] || null)}
              className={commonInputClass}
              required={field.required}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <UserPlusIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Walk-In Registration</h2>
              <p className="text-sm text-gray-600">{event.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Loading State */}
          {loadingForm ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading registration form...</span>
            </div>
          ) : (
            <>
              {/* Dynamic Registration Form Fields */}
              {registrationForm.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Attendee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {registrationForm.map(field => renderFormField(field))}
                  </div>
                </div>
              )}

              {/* Fallback if no custom form is configured */}
              {registrationForm.length === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Attendee Information</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ No registration form configured for this event. Using default fields.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.customFormData?.name || ''}
                        onChange={(e) => handleCustomFieldChange('name', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.customFormData?.email || ''}
                        onChange={(e) => handleCustomFieldChange('email', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="john@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.customFormData?.phoneNumber || ''}
                        onChange={(e) => handleCustomFieldChange('phoneNumber', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+63 912 345 6789"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organization
                      </label>
                      <input
                        type="text"
                        value={formData.customFormData?.organization || ''}
                        onChange={(e) => handleCustomFieldChange('organization', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Company/School"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ticket Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Ticket Selection</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ticket Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="ticketTypeId"
                  value={formData.ticketTypeId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a ticket type</option>
                  {event.ticketTypes.filter(t => t.isActive).map(ticket => (
                    <option key={ticket.id} value={ticket.id}>
                      {ticket.name} - ₱{ticket.price.toFixed(2)}
                      {ticket.maxQuantity && ` (${ticket.maxQuantity - ticket.currentSold} left)`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  min="1"
                  max={selectedTicket?.maxQuantity ? selectedTicket.maxQuantity - selectedTicket.currentSold : undefined}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {selectedTicket && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₱{calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Payment Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="paymentStatus"
                  value={formData.paymentStatus}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {formData.paymentStatus === 'paid' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="bank-transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {formData.paymentStatus === 'paid' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference/Receipt Number
                  </label>
                  <input
                    type="text"
                    name="paymentReference"
                    value={formData.paymentReference}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Receipt #12345 or Transaction ID"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any additional information..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={isSubmitting || loadingForm}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              disabled={isSubmitting || loadingForm}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-5 w-5" />
                  <span>Register Attendee</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalkInRegistrationModal;
