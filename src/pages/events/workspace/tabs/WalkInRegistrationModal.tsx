import React, { useState, useEffect } from 'react';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { Event, TicketType, FormField } from '../../../../types';
import { EventService } from '../../../../services/eventService';
import { isTicketWindowOpen } from '../../../../utils/pricing';
import { logger } from '../../../../utils/logger';
import toast from 'react-hot-toast';
import FormattedLabelText, { stripFormattedLabelSyntax } from '../../../../components/FormattedLabelText';
import { Modal } from '../../../../components/UI';
import { LoadingSpinner } from '../../../../components/UI';
import { Button } from '../../../../components/UI';
import { Input } from '../../../../components/UI';
import { Select } from '../../../../components/UI';
import { Textarea } from '../../../../components/UI';

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
      // Pre-select first active ticket type within its sales window
      const firstActiveTicket = event.ticketTypes.find(t => t.isActive && isTicketWindowOpen(t));
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
        logger.error('Failed to load registration form:', error);
        toast.error('Failed to load registration form. Please close and re-open the dialog.');
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

    // Validate custom form fields
    for (const field of registrationForm) {
      if (field.type === 'spacer') continue;

      const plainLabel = stripFormattedLabelSyntax(field.label);

      if (field.required) {
        const value = formData.customFormData?.[field.id];
        
        if (!value || (typeof value === 'string' && !value.trim())) {
          toast.error(`${plainLabel} is required`);
          return;
        }

        // Email validation
        if (field.type === 'email' && typeof value === 'string' && !value.includes('@')) {
          toast.error(`Please enter a valid email for ${plainLabel}`);
          return;
        }

        // Phone validation (basic)
        if (field.type === 'phone' && typeof value === 'string' && value.trim() && value.length < 10) {
          toast.error(`Please enter a valid phone number for ${plainLabel}`);
          return;
        }
      }
    }

    // Check ticket availability
    if (selectedTicket) {
      const available = selectedTicket.maxQuantity 
        ? selectedTicket.maxQuantity - selectedTicket.currentSold 
        : Infinity;
      
      if (available <= 0) {
        toast.error(`Tickets for ${selectedTicket.name} are sold out`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit({ ...formData, quantity: 1 });
      
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
      toast.success('Walk-in registration completed.');
    } catch (error: any) {
      logger.error('Walk-in registration error:', error);
      toast.error(error.message || 'Failed to register walk-in attendee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedTicket) return 0;
    return selectedTicket.price;
  };

  // Render dynamic form field
  const renderFormField = (field: FormField) => {
    const value = formData.customFormData?.[field.id] || '';
    const gridClass = field.gridSize === 'full' ? 'md:col-span-2' : '';
    const label = stripFormattedLabelSyntax(field.label);

    // Radio and multi-select have no single control for a label to point at, so
    // they take the native group construct. Everything else goes through the
    // primitives, which is what the local `commonInputClass` string used to
    // stand in for: one height, one focus ring, one error treatment.
    const optionRow =
      'flex min-h-control cursor-pointer items-center gap-3 rounded-md border border-outline-variant bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low';

    switch (field.type) {
      case 'spacer':
        return (
          <div key={field.id} className="md:col-span-2 py-2">
            <div className="h-0.5 w-full rounded-full bg-surface-container" />
          </div>
        );

      case 'text':
      case 'email':
      case 'phone':
      case 'number':
      case 'date':
        return (
          <div key={field.id} className={gridClass}>
            <Input
              type={field.type === 'phone' ? 'tel' : field.type}
              label={label}
              required={field.required}
              hint={field.description}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className={gridClass}>
            <Textarea
              label={label}
              required={field.required}
              hint={field.description}
              rows={3}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className={gridClass}>
            <Select
              label={label}
              required={field.required}
              hint={field.description}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
            >
              <option value="">Select an option</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </div>
        );

      case 'radio':
        return (
          <fieldset key={field.id} className={gridClass}>
            <legend className="mb-2xs text-sm font-medium text-on-surface">
              {label}
              {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
            </legend>
            {field.description && (
              <p className="mb-2 text-sm text-on-surface-variant">{field.description}</p>
            )}
            <div className="space-y-2xs">
              {field.options?.map((option) => (
                <label key={option} className={optionRow}>
                  <input
                    type="radio"
                    name={field.id}
                    value={option}
                    checked={value === option}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    className="h-4 w-4 shrink-0 accent-primary"
                    required={field.required}
                  />
                  <span className="min-w-0 text-sm text-on-surface">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );

      case 'checkbox':
        return (
          <div key={field.id} className={gridClass}>
            <label className={`${optionRow} items-start`}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleCustomFieldChange(field.id, e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded accent-primary"
                required={field.required}
              />
              <span className="min-w-0 text-sm text-on-surface">
                <FormattedLabelText value={field.label} /> {field.required && <span className="text-error" aria-hidden="true">*</span>}
              </span>
            </label>
            {field.description && (
              <p className="mt-2xs text-sm text-on-surface-variant">{field.description}</p>
            )}
          </div>
        );

      case 'multiselect': {
        const current: string[] = Array.isArray(value) ? value : [];
        return (
          <fieldset key={field.id} className={gridClass}>
            <legend className="mb-2xs text-sm font-medium text-on-surface">
              {label}
              {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
            </legend>
            {field.description && (
              <p className="mb-2 text-sm text-on-surface-variant">{field.description}</p>
            )}
            <div className="max-h-40 space-y-2xs overflow-y-auto rounded-lg border border-outline-variant bg-surface p-2xs">
              {field.options?.map((option) => (
                <label key={option} className={`${optionRow} border-none bg-transparent px-2xs hover:bg-surface-container-low`}>
                  <input
                    type="checkbox"
                    value={option}
                    checked={current.includes(option)}
                    onChange={(e) => {
                      handleCustomFieldChange(
                        field.id,
                        e.target.checked
                          ? [...current, option]
                          : current.filter((v) => v !== option)
                      );
                    }}
                    className="h-4 w-4 shrink-0 rounded accent-primary"
                  />
                  <span className="min-w-0 text-sm text-on-surface">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      }

      case 'rating': {
        const current: number = value || 0;
        return (
          <div key={field.id} className={gridClass}>
            <p className="mb-2xs text-sm font-medium text-on-surface">
              {label}
              {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
            </p>
            {field.description && (
              <p className="mb-2 text-sm text-on-surface-variant">{field.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3xs" role="group" aria-label={label}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant="text"
                  aria-label={`Rate ${rating} out of 5`}
                  aria-pressed={current === rating}
                  onClick={() => handleCustomFieldChange(field.id, rating)}
                  className={`min-w-[48px] text-2xl leading-none ${
                    current >= rating ? 'text-warning-amber' : 'text-outline'
                  }`}
                >
                  <StarIcon className="h-6 w-6" aria-hidden="true" />
                </Button>
              ))}
              {current > 0 && (
                <span className="text-sm text-on-surface-variant">{current} out of 5</span>
              )}
            </div>
          </div>
        );
      }

      case 'file':
        return (
          <div key={field.id} className={gridClass}>
            <Input
              type="file"
              label={label}
              required={field.required}
              hint={field.description}
              onChange={(e) => handleCustomFieldChange(field.id, e.target.files?.[0] || null)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Walk-In Registration"
      footer={null}
    >
      <p className="-mt-6 mb-4 text-sm text-on-surface-variant">{event.title}</p>
      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Loading State */}
          {loadingForm ? (
            <div className="flex flex-col items-center py-12">
              <LoadingSpinner size="sm" />
              <span className="text-on-surface-variant">Loading registration form...</span>
            </div>
          ) : (
            <>
              {/* Dynamic Registration Form Fields */}
              {registrationForm.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-on-surface">Attendee Information</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {registrationForm.map(field => renderFormField(field))}
                  </div>
                </div>
              )}

              {/* Fallback if no custom form is configured */}
              {registrationForm.length === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-on-surface">Attendee Information</h3>
                  <div className="rounded-lg border border-outline-variant bg-warning-container p-4">
                    <p className="text-sm text-on-warning-container">
                      No registration form configured for this event. Using default fields.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="Full Name"
                      required
                      autoComplete="name"
                      value={formData.customFormData?.name || ''}
                      onChange={(e) => handleCustomFieldChange('name', e.target.value)}
                      placeholder="John Doe"
                    />

                    <Input
                      type="email"
                      label="Email"
                      required
                      autoComplete="email"
                      value={formData.customFormData?.email || ''}
                      onChange={(e) => handleCustomFieldChange('email', e.target.value)}
                      placeholder="john@example.com"
                    />

                    <Input
                      type="tel"
                      label="Phone Number"
                      autoComplete="tel"
                      value={formData.customFormData?.phoneNumber || ''}
                      onChange={(e) => handleCustomFieldChange('phoneNumber', e.target.value)}
                      placeholder="+63 912 345 6789"
                    />

                    <Input
                      label="Organization"
                      autoComplete="organization"
                      value={formData.customFormData?.organization || ''}
                      onChange={(e) => handleCustomFieldChange('organization', e.target.value)}
                      placeholder="Company/School"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ticket Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-on-surface">Ticket Selection</h3>

            <div>
              <Select
                name="ticketTypeId"
                label="Ticket Type"
                required
                placeholder="Select a ticket type"
                value={formData.ticketTypeId}
                onChange={handleInputChange}
                options={event.ticketTypes
                  .filter(t => t.isActive && isTicketWindowOpen(t))
                  .map(ticket => ({
                    value: ticket.id,
                    label: `${ticket.name} - ₱${ticket.price.toFixed(2)}${
                      ticket.maxQuantity ? ` (${ticket.maxQuantity - ticket.currentSold} left)` : ''
                    }`
                  }))}
              />
            </div>

            {selectedTicket && (
              <div className="rounded-lg border border-primary-container bg-primary-container p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-on-surface">Total Amount:</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    ₱{calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-on-surface">Payment Information</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                name="paymentStatus"
                label="Payment Status"
                required
                value={formData.paymentStatus}
                onChange={handleInputChange}
                options={[
                  { value: 'paid', label: 'Paid' },
                  { value: 'pending', label: 'Pending' }
                ]}
              />

              {formData.paymentStatus === 'paid' && (
                <Select
                  name="paymentMethod"
                  label="Payment Method"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'gcash', label: 'GCash' },
                    { value: 'bank-transfer', label: 'Bank Transfer' },
                    { value: 'other', label: 'Other' }
                  ]}
                />
              )}

              {formData.paymentStatus === 'paid' && (
                <div className="md:col-span-2">
                  <Input
                    mono
                    name="paymentReference"
                    label="Payment Reference/Receipt Number"
                    value={formData.paymentReference}
                    onChange={handleInputChange}
                    placeholder="Receipt #12345 or Transaction ID"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <Textarea
            name="notes"
            label="Additional Notes"
            rows={3}
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Any additional information..."
          />

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-outline-variant pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="outlined"
              onClick={onClose}
              disabled={isSubmitting || loadingForm}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={loadingForm}
              icon={<UserPlusIcon />}
            >
              Register Attendee
            </Button>
          </div>
        </form>
    </Modal>
  );
};

export default WalkInRegistrationModal;
