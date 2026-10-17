import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon, TicketIcon, UserIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { EventService } from '../../../services/eventService';
import { RegistrationService } from '../../../services/registrationService';
import TicketSelector, { TicketSelection } from './TicketSelector';
import { Button, Card, Input, Select, Textarea } from '../../../components/UI';
import { Event, FormField } from '../../../types';
import { logger } from '../../../utils/logger';
import toast from 'react-hot-toast';
import FormattedLabelText, { stripFormattedLabelSyntax } from '../../../components/FormattedLabelText';
import {
  validateEmail,
  validateFullName,
  validatePhoneNumber,
  validateDynamicField,
} from '../../../utils/formValidation';

interface RegistrationFormProps {
  event: Event;
  registrationForm: FormField[];
  isPreview?: boolean;
  onSuccess?: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({
  event,
  registrationForm,
  isPreview = false,
  onSuccess
}) => {
  const navigate = useNavigate();
  const [ticketSelection, setTicketSelection] = useState<TicketSelection | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const ticketSelectorRef = useRef<HTMLDivElement>(null);

  const [registrationData, setRegistrationData] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    customResponses: {} as Record<string, any>
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [, setTouchedFields] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize the ticket selection handler to prevent infinite re-renders
  const handleTicketSelectionChange = useCallback((selection: TicketSelection) => {
    setTicketSelection(selection);
    setTicketError(null);
  }, []);

  // Accurately identify attendee name and email fields without false positives on company/org fields
  const isFullNameField = (field: FormField): boolean => {
    const rawLabel = stripFormattedLabelSyntax(field.label).toLowerCase();
    const rawId = field.id.toLowerCase();
    if (rawLabel.includes('company') || rawLabel.includes('organization') || rawLabel.includes('venue') || rawLabel.includes('business')) {
      return false;
    }
    return (
      rawLabel.includes('full name') ||
      rawLabel.includes('your name') ||
      rawLabel.includes('attendee name') ||
      rawLabel.includes('participant name') ||
      rawLabel.includes('complete name') ||
      rawLabel === 'name' ||
      rawId === 'name' ||
      rawId === 'fullname' ||
      rawId === 'full_name' ||
      rawId === 'attendee_name'
    );
  };

  const isFirstNameField = (field: FormField): boolean => {
    const rawLabel = stripFormattedLabelSyntax(field.label).toLowerCase();
    const rawId = field.id.toLowerCase();
    if (rawLabel.includes('company') || rawLabel.includes('organization') || rawLabel.includes('venue') || rawLabel.includes('business')) {
      return false;
    }
    return (
      rawLabel.includes('first name') ||
      rawLabel.includes('given name') ||
      rawLabel === 'first' ||
      rawId === 'firstname' ||
      rawId === 'first_name' ||
      rawId === 'first' ||
      rawId === '1' // DevFest Davao convention
    );
  };

  const isLastNameField = (field: FormField): boolean => {
    const rawLabel = stripFormattedLabelSyntax(field.label).toLowerCase();
    const rawId = field.id.toLowerCase();
    if (rawLabel.includes('company') || rawLabel.includes('organization') || rawLabel.includes('venue') || rawLabel.includes('business')) {
      return false;
    }
    return (
      rawLabel.includes('last name') ||
      rawLabel.includes('family name') ||
      rawLabel.includes('surname') ||
      rawLabel === 'last' ||
      rawId === 'lastname' ||
      rawId === 'last_name' ||
      rawId === 'surname' ||
      rawId === '1762143123275' // DevFest Davao convention
    );
  };

  const isEmailField = (field: FormField): boolean => {
    const rawLabel = stripFormattedLabelSyntax(field.label).toLowerCase();
    const rawId = field.id.toLowerCase();
    return (
      field.type === 'email' ||
      rawLabel.includes('email') ||
      rawId.includes('email')
    );
  };

  const customEmailField = registrationForm.find(isEmailField);
  const customFullNameField = registrationForm.find(isFullNameField);
  const customFirstNameField = registrationForm.find(isFirstNameField);
  const customLastNameField = registrationForm.find(isLastNameField);

  const hasCustomEmail = Boolean(customEmailField);
  const hasCustomName = Boolean(customFullNameField || customFirstNameField || customLastNameField);

  // Blur handler for dynamic custom fields
  const handleDynamicBlur = (field: FormField) => {
    setTouchedFields(prev => ({ ...prev, [field.id]: true }));
    const val = registrationData.customResponses[field.id];
    const res = validateDynamicField(field, val);
    setFieldErrors(prev => {
      const next = { ...prev };
      if (!res.isValid && res.error) {
        next[field.id] = res.error;
      } else {
        delete next[field.id];
      }
      return next;
    });
  };

  // Blur handler for standard contact fields (fallback or missing custom fields)
  const handleFallbackBlur = (fieldName: 'name' | 'email' | 'phone' | 'organization') => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
    let res: { isValid: boolean; error?: string } = { isValid: true };
    if (fieldName === 'name') {
      res = validateFullName(registrationData.name);
    } else if (fieldName === 'email') {
      res = validateEmail(registrationData.email);
    } else if (fieldName === 'phone') {
      res = validatePhoneNumber(registrationData.phone, false);
    }
    setFieldErrors(prev => {
      const next = { ...prev };
      if (!res.isValid && res.error) {
        next[fieldName] = res.error;
      } else {
        delete next[fieldName];
      }
      return next;
    });
  };

  // Change handler for standard contact fields with real-time error clearing
  const handleFallbackChange = (fieldName: 'name' | 'email' | 'phone' | 'organization', value: string) => {
    setRegistrationData(prev => ({ ...prev, [fieldName]: value }));
    if (fieldErrors[fieldName]) {
      let res: { isValid: boolean; error?: string } = { isValid: true };
      if (fieldName === 'name') {
        res = validateFullName(value);
      } else if (fieldName === 'email') {
        res = validateEmail(value);
      } else if (fieldName === 'phone') {
        res = validatePhoneNumber(value, false);
      }
      setFieldErrors(prev => {
        const next = { ...prev };
        if (res.isValid) {
          delete next[fieldName];
        } else if (res.error) {
          next[fieldName] = res.error;
        }
        return next;
      });
    }
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    logger.log('Form submitted. Event:', event?.id, 'Ticket selection:', ticketSelection);
    
    if (!event || !ticketSelection) {
      setTicketError('Please select a ticket type to continue.');
      toast.error('Please select a ticket type');
      ticketSelectorRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }

    const errors: Record<string, string> = {};
    let firstErrorFieldId: string | null = null;

    if (registrationForm.length > 0) {
      // Validate all configured dynamic form fields
      for (const field of registrationForm) {
        if (field.type === 'spacer') continue;
        const val = registrationData.customResponses[field.id];
        const res = validateDynamicField(field, val);
        if (!res.isValid && res.error) {
          errors[field.id] = res.error;
          if (!firstErrorFieldId) firstErrorFieldId = field.id;
        }
      }

      // If the custom form does not have explicit name/email fields, validate the guaranteed contact fields
      if (!hasCustomName) {
        const nameRes = validateFullName(registrationData.name);
        if (!nameRes.isValid && nameRes.error) {
          errors['name'] = nameRes.error;
          if (!firstErrorFieldId) firstErrorFieldId = 'name';
        }
      }

      if (!hasCustomEmail) {
        const emailRes = validateEmail(registrationData.email);
        if (!emailRes.isValid && emailRes.error) {
          errors['email'] = emailRes.error;
          if (!firstErrorFieldId) firstErrorFieldId = 'email';
        }
      }

      if (registrationData.phone) {
        const phoneRes = validatePhoneNumber(registrationData.phone, false);
        if (!phoneRes.isValid && phoneRes.error) {
          errors['phone'] = phoneRes.error;
          if (!firstErrorFieldId) firstErrorFieldId = 'phone';
        }
      }
    } else {
      // Validate fallback form fields
      const nameRes = validateFullName(registrationData.name);
      if (!nameRes.isValid && nameRes.error) {
        errors['name'] = nameRes.error;
        if (!firstErrorFieldId) firstErrorFieldId = 'name';
      }

      const emailRes = validateEmail(registrationData.email);
      if (!emailRes.isValid && emailRes.error) {
        errors['email'] = emailRes.error;
        if (!firstErrorFieldId) firstErrorFieldId = 'email';
      }

      if (registrationData.phone) {
        const phoneRes = validatePhoneNumber(registrationData.phone, false);
        if (!phoneRes.isValid && phoneRes.error) {
          errors['phone'] = phoneRes.error;
          if (!firstErrorFieldId) firstErrorFieldId = 'phone';
        }
      }
    }

    // Halt submission and guide user to errors if validation fails
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error('Please correct the highlighted fields before proceeding.');
      if (firstErrorFieldId) {
        const el = document.getElementById(firstErrorFieldId) || document.querySelector(`[name="${firstErrorFieldId}"]`);
        if (el && 'focus' in el) {
          (el as HTMLElement).focus();
          el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Prepare user details based on form type
      let userDetails;
      if (registrationForm.length > 0) {
        const rawEmail = customEmailField ? registrationData.customResponses[customEmailField.id] : registrationData.email;
        const emailRes = validateEmail(rawEmail);

        let rawName = '';
        if (customFullNameField) {
          rawName = registrationData.customResponses[customFullNameField.id];
        } else if (customFirstNameField || customLastNameField) {
          const first = (customFirstNameField && typeof registrationData.customResponses[customFirstNameField.id] === 'string')
            ? registrationData.customResponses[customFirstNameField.id].trim()
            : '';
          const last = (customLastNameField && typeof registrationData.customResponses[customLastNameField.id] === 'string')
            ? registrationData.customResponses[customLastNameField.id].trim()
            : '';
          rawName = `${first} ${last}`.trim() || first || last;
        } else {
          rawName = registrationData.name;
        }
        const nameRes = validateFullName(rawName);

        const phoneVal = registrationData.phone ? validatePhoneNumber(registrationData.phone).normalized : null;

        userDetails = {
          name: nameRes.normalized || (typeof rawName === 'string' ? rawName.trim() : ''),
          email: emailRes.normalized || '',
          phoneNumber: phoneVal,
          organization: registrationData.organization.trim() || null
        };
      } else {
        const emailRes = validateEmail(registrationData.email);
        const nameRes = validateFullName(registrationData.name);
        const phoneVal = registrationData.phone ? validatePhoneNumber(registrationData.phone).normalized : null;

        userDetails = {
          name: nameRes.normalized || registrationData.name.trim(),
          email: emailRes.normalized || '',
          phoneNumber: phoneVal,
          organization: registrationData.organization.trim() || null
        };
      }

      const registrationPayload = {
        eventId: event.id,
        ticketTypeId: ticketSelection.ticketTypeId,
        quantity: 1,
        promoCode: ticketSelection.promoCode,
        userDetails,
        customResponses: registrationData.customResponses,
        agreeToTerms: true,
        subscribeToUpdates: false
      };

      // In preview mode, validate responses without creating actual records
      if (isPreview) {
        toast.success('[Preview Mode] Form validated successfully. No registration was created.');
        onSuccess?.();
        setIsSubmitting(false);
        return;
      }

      // Check if event requires payment
      const requiresPayment = ticketSelection.totalAmount > 0;
      
      if (requiresPayment) {
        // For paid events, store registration data in session storage instead of Firestore
        // This prevents storing incomplete registrations until payment is verified
        const tempRegistrationId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store registration data in session storage
        const tempRegistrationData = {
          ...registrationPayload,
          registrationId: tempRegistrationId,
          totalAmount: ticketSelection.totalAmount,
          originalAmount: ticketSelection.originalAmount,
          discountAmount: ticketSelection.discountAmount,
          timestamp: Date.now()
        };
        
        sessionStorage.setItem(`temp_registration_${tempRegistrationId}`, JSON.stringify(tempRegistrationData));
        
        logger.log('Navigating to payment page with ID:', tempRegistrationId);
        toast.success('Registration details saved. Please proceed to payment.');
        
        // Navigate to payment page with temporary registration ID
        navigate(`/payment/${tempRegistrationId}`);
      } else {
        // For free events, create registration immediately in Firestore
        const registration = await RegistrationService.createPendingRegistration(registrationPayload);
        
        // Send immediate registration confirmation email
        try {
          await RegistrationService.sendRegistrationConfirmationEmail(
            registration.registrationId,
            event.id,
            userDetails.email,
            userDetails.name,
            registration.requiresPayment
          );
        } catch (emailError) {
          logger.warn('Failed to send confirmation email:', emailError);
          // Don't block the flow if email fails
        }
        
        toast.success('Registration completed. A confirmation email has been sent.');
        
        // Navigate to dedicated success page for free events
        navigate('/registration/success');
      }
    } catch (err: any) {
      logger.error('Registration error:', err);
      const errorMessage = err?.message || '';
      const isDuplicate =
        err?.code === 'functions/already-exists' ||
        err?.code === 'already-exists' ||
        errorMessage.toLowerCase().includes('already registered') ||
        errorMessage.toLowerCase().includes('already exists');

      if (isDuplicate) {
        const emailFieldKey = customEmailField ? customEmailField.id : 'email';
        setFieldErrors(prev => ({
          ...prev,
          [emailFieldKey]: 'You are already registered for this event with this email address.'
        }));
        toast.error('You are already registered for this event with this email address. Please check your inbox for your confirmation and ticket.', {
          duration: 6000
        });
        const el = document.getElementById(emailFieldKey) || document.querySelector(`[name="${emailFieldKey}"]`);
        if (el && 'focus' in el) {
          (el as HTMLElement).focus();
          el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
      } else {
        toast.error(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter only active tickets for display
  const activeTicketTypes = event.ticketTypes?.filter(ticket => ticket.isActive !== false) || [];

  const setResponse = (fieldId: string, value: unknown) => {
    setRegistrationData(prev => ({
      ...prev,
      customResponses: { ...prev.customResponses, [fieldId]: value }
    }));
    if (fieldErrors[fieldId]) {
      const field = registrationForm.find(f => f.id === fieldId);
      if (field) {
        const res = validateDynamicField(field, value);
        setFieldErrors(prev => {
          const next = { ...prev };
          if (res.isValid) {
            delete next[fieldId];
          } else if (res.error) {
            next[fieldId] = res.error;
          }
          return next;
        });
      }
    }
  };

  /**
   * One renderer for every organizer-configured field type.
   *
   * Labels arrive as authored strings that may carry `**bold**` or a link, and
   * the primitives take a plain `label: string`. They are passed through
   * `stripFormattedLabelSyntax` for exactly that reason; the only place that
   * still renders the authored formatting is the standalone checkbox, where the
   * label IS the control's own label element.
   */
  const renderDynamicField = (field: FormField) => {
    const raw = registrationData.customResponses[field.id] ?? '';
    const label = stripFormattedLabelSyntax(field.label);
    const placeholderFor = () =>
      field.placeholder || `Enter your ${stripFormattedLabelSyntax(field.label).toLowerCase()}`;
    const errorMsg = fieldErrors[field.id];

    if (field.type === 'textarea') {
      return (
        <Textarea
          id={field.id}
          name={field.id}
          label={label}
          required={field.required}
          error={errorMsg}
          rows={3}
          value={raw}
          onBlur={() => handleDynamicBlur(field)}
          onChange={(e) => setResponse(field.id, e.target.value)}
          placeholder={placeholderFor()}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <Select
          id={field.id}
          name={field.id}
          label={label}
          required={field.required}
          error={errorMsg}
          value={raw}
          onBlur={() => handleDynamicBlur(field)}
          onChange={(e) => setResponse(field.id, e.target.value)}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      );
    }

    // Radio and multi-select are groups, so they get the native group
    // construct: a <fieldset> with a <legend>.
    if (field.type === 'radio') {
      const isInvalid = Boolean(errorMsg);
      return (
        <fieldset id={field.id} aria-invalid={isInvalid} aria-describedby={isInvalid ? `${field.id}-error` : undefined}>
          <legend className="mb-2xs text-sm font-medium text-on-surface">
            {label}
            {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
          </legend>
          <div className="space-y-2xs">
            {field.options?.map((option) => (
              <label
                key={option}
                className={`flex min-h-control cursor-pointer items-center gap-3 rounded-md border bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${
                  isInvalid ? 'border-error' : 'border-outline-variant'
                }`}
              >
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={raw === option}
                  onBlur={() => handleDynamicBlur(field)}
                  onChange={(e) => setResponse(field.id, e.target.value)}
                  className="h-4 w-4 shrink-0 accent-primary"
                  required={field.required && !raw}
                />
                <span className="min-w-0 text-base text-on-surface">{option}</span>
              </label>
            ))}
          </div>
          {isInvalid && (
            <p id={`${field.id}-error`} role="alert" className="animate-rise-in motion-reduce:animate-none mt-2xs flex items-center gap-3xs text-sm text-error">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
          )}
        </fieldset>
      );
    }

    if (field.type === 'multiselect') {
      const current: string[] = Array.isArray(raw) ? raw : [];
      const isInvalid = Boolean(errorMsg);
      return (
        <fieldset id={field.id} aria-invalid={isInvalid} aria-describedby={isInvalid ? `${field.id}-error` : undefined}>
          <legend className="mb-2xs text-sm font-medium text-on-surface">
            {label}
            {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
          </legend>
          <div className="space-y-2xs">
            {field.options?.map((option) => (
              <label
                key={option}
                className={`flex min-h-control cursor-pointer items-center gap-3 rounded-md border bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${
                  isInvalid ? 'border-error' : 'border-outline-variant'
                }`}
              >
                <input
                  type="checkbox"
                  checked={current.includes(option)}
                  onBlur={() => handleDynamicBlur(field)}
                  onChange={(e) =>
                    setResponse(
                      field.id,
                      e.target.checked
                        ? [...current, option]
                        : current.filter((v) => v !== option)
                    )
                  }
                  className="h-4 w-4 shrink-0 rounded accent-primary"
                />
                <span className="min-w-0 text-base text-on-surface">{option}</span>
              </label>
            ))}
          </div>
          {isInvalid && (
            <p id={`${field.id}-error`} role="alert" className="animate-rise-in motion-reduce:animate-none mt-2xs flex items-center gap-3xs text-sm text-error">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
          )}
        </fieldset>
      );
    }

    if (field.type === 'checkbox') {
      const isInvalid = Boolean(errorMsg);
      return (
        <div id={field.id}>
          <label className={`flex min-h-control cursor-pointer items-start gap-3 rounded-md border bg-surface p-md transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${
            isInvalid ? 'border-error' : 'border-outline-variant'
          }`}>
            <input
              type="checkbox"
              checked={raw === true}
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? `${field.id}-error` : undefined}
              onBlur={() => handleDynamicBlur(field)}
              onChange={(e) => setResponse(field.id, e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded accent-primary"
              required={field.required}
            />
            <span className="min-w-0 text-base text-on-surface">
              {field.placeholder || <FormattedLabelText value={field.label} />}
            </span>
          </label>
          {isInvalid && (
            <p id={`${field.id}-error`} role="alert" className="animate-rise-in motion-reduce:animate-none mt-2xs flex items-center gap-3xs text-sm text-error">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
          )}
        </div>
      );
    }

    if (field.type === 'rating') {
      const current: number = raw || 0;
      const isInvalid = Boolean(errorMsg);
      return (
        <div id={field.id} aria-invalid={isInvalid} aria-describedby={isInvalid ? `${field.id}-error` : undefined}>
          <p className="mb-2xs text-sm font-medium text-on-surface">
            {label}
            {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
          </p>
          <div className="flex flex-wrap items-center gap-3xs">
            {[1, 2, 3, 4, 5].map((star) => (
              <Button
                key={star}
                variant="text"
                aria-label={`Rate ${star} out of 5`}
                aria-pressed={current === star}
                onClick={() => {
                  setResponse(field.id, star);
                  if (fieldErrors[field.id]) {
                    setFieldErrors(prev => {
                      const next = { ...prev };
                      delete next[field.id];
                      return next;
                    });
                  }
                }}
                className={`min-w-[48px] text-2xl leading-none ${
                  current >= star ? 'text-warning-amber' : 'text-outline'
                }`}
              >
                <StarIcon className="h-6 w-6" aria-hidden="true" />
              </Button>
            ))}
            {current > 0 && (
              <span className="text-sm text-on-surface-variant">{current} out of 5</span>
            )}
          </div>
          {isInvalid && (
            <p id={`${field.id}-error`} role="alert" className="animate-rise-in motion-reduce:animate-none mt-2xs flex items-center gap-3xs text-sm text-error">
              <ExclamationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {errorMsg}
            </p>
          )}
        </div>
      );
    }

    return (
      <Input
        id={field.id}
        name={field.id}
        type={field.type}
        label={label}
        required={field.required}
        error={errorMsg}
        value={raw}
        onBlur={() => handleDynamicBlur(field)}
        onChange={(e) => setResponse(field.id, e.target.value)}
        placeholder={placeholderFor()}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Ticket Selection */}
      {activeTicketTypes.length > 0 && (
        <div ref={ticketSelectorRef} id="ticket-selection-card">
          <Card padding="md" className={ticketError ? 'ring-2 ring-error' : ''}>
            <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2xs">
              <TicketIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              Choose Your Ticket
            </h2>
            {ticketError && (
              <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-error-container p-3 text-sm text-on-error-container">
                <ExclamationCircleIcon className="h-5 w-5 shrink-0 text-error" aria-hidden="true" />
                <span>{ticketError}</span>
              </div>
            )}
            <TicketSelector
              ticketTypes={activeTicketTypes}
              promoCodes={event.promoCodes || []}
              onSelectionChange={handleTicketSelectionChange}
            />
          </Card>
        </div>
      )}

      {/* Registration Form */}
      {ticketSelection && (
        <Card padding="md">
          <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2xs">
            <UserIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            Registration Details
          </h2>
          <form onSubmit={handleRegistrationSubmit} className="space-y-6" noValidate>
            {/* Dynamic Form Fields from Event Configuration */}
            {registrationForm.length > 0 ? (
              <div className="space-y-6">
                {/* Guaranteed contact inputs if organizer omitted name or email in custom form */}
                {(!hasCustomName || !hasCustomEmail) && (
                  <div className="rounded-lg border border-outline-variant bg-surface-container-low p-md">
                    <h3 className="mb-3 text-sm font-semibold text-on-surface">Contact Information</h3>
                    <div className="grid grid-cols-1 gap-x-md gap-y-md md:grid-cols-2">
                      {!hasCustomName && (
                        <div className="md:col-span-1">
                          <Input
                            id="name"
                            name="name"
                            label="Full Name"
                            required
                            autoComplete="name"
                            error={fieldErrors['name']}
                            value={registrationData.name}
                            onBlur={() => handleFallbackBlur('name')}
                            onChange={(e) => handleFallbackChange('name', e.target.value)}
                            placeholder="Enter your full name"
                          />
                        </div>
                      )}
                      {!hasCustomEmail && (
                        <div className="md:col-span-1">
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            label="Email Address"
                            required
                            autoComplete="email"
                            error={fieldErrors['email']}
                            value={registrationData.email}
                            onBlur={() => handleFallbackBlur('email')}
                            onChange={(e) => handleFallbackChange('email', e.target.value)}
                            placeholder="Enter your email address"
                            hint="Ticket QR and event updates will be sent to this address."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-x-md gap-y-md md:grid-cols-2">
                  {registrationForm.map((field) => (
                    <div
                      key={field.id}
                      className={`${field.type === 'spacer' || field.gridSize !== 'half' ? 'md:col-span-2' : 'md:col-span-1'}`}
                    >
                      {field.type === 'spacer' ? (
                        <div className="py-4">
                          <div className="h-0.5 w-full rounded-full bg-surface-container" />
                        </div>
                      ) : (
                        renderDynamicField(field)
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Fallback to basic form if no custom form is configured */
              <div className="space-y-md">
                <Input
                  id="name"
                  name="name"
                  label="Full Name"
                  required
                  autoComplete="name"
                  error={fieldErrors['name']}
                  value={registrationData.name}
                  onBlur={() => handleFallbackBlur('name')}
                  onChange={(e) => handleFallbackChange('name', e.target.value)}
                  placeholder="Enter your full name"
                />

                <Input
                  id="email"
                  name="email"
                  type="email"
                  label="Email Address"
                  required
                  autoComplete="email"
                  error={fieldErrors['email']}
                  value={registrationData.email}
                  onBlur={() => handleFallbackBlur('email')}
                  onChange={(e) => handleFallbackChange('email', e.target.value)}
                  placeholder="Enter your email address"
                  hint="Ticket QR and confirmation details will be sent here."
                />

                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  label="Phone Number"
                  autoComplete="tel"
                  error={fieldErrors['phone']}
                  value={registrationData.phone}
                  onBlur={() => handleFallbackBlur('phone')}
                  onChange={(e) => handleFallbackChange('phone', e.target.value)}
                  placeholder="e.g. 09123456789 or +639123456789"
                />

                <Input
                  id="organization"
                  name="organization"
                  label="Organization"
                  autoComplete="organization"
                  value={registrationData.organization}
                  onChange={(e) => handleFallbackChange('organization', e.target.value)}
                  placeholder="Company, university, or community"
                />
              </div>
            )}

            {/* Total Amount */}
            <div className="rounded-lg border border-primary-container bg-primary-container p-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold text-on-surface">Total Amount:</span>
                {ticketSelection.totalAmount > 0 ? (
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    ₱{ticketSelection.totalAmount.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-success">Free</span>
                )}
              </div>
              {ticketSelection.discountAmount > 0 && (
                <div className="mt-2 text-base text-success">
                  You saved ₱{ticketSelection.discountAmount.toLocaleString()}!
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isSubmitting}
              icon={<CheckCircleIcon />}
            >
              {ticketSelection.totalAmount > 0 ? 'Proceed to Payment' : 'Complete Registration'}
            </Button>

            <p className="mt-3 text-center text-xs text-on-surface-variant">
              By registering, you agree to our{' '}
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Terms of Service
              </a>{' '}
              and acknowledge our{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Privacy Policy
              </a>.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
};

export default RegistrationForm;
