import React, { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { FormField } from '../../../types';
import FormattedLabelText, { stripFormattedLabelSyntax } from '../../../components/FormattedLabelText';
import { Button } from '../../../components/UI';
import { Field } from '../../../components/UI';
import { Input } from '../../../components/UI';
import { Select } from '../../../components/UI';
import { Textarea } from '../../../components/UI';

interface FormRendererProps {
  fields: FormField[];
  onSubmit?: (data: Record<string, any>) => void;
  submitButtonText?: string;
  className?: string;
  disabled?: boolean;
}

const FormRenderer: React.FC<FormRendererProps> = ({
  fields,
  onSubmit,
  submitButtonText = "Submit",
  className = "",
  disabled = false
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));

    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    fields.forEach(field => {
      if (field.type === 'spacer') return;

      const value = formData[field.id];

      // Required field validation
      if (field.required && (!value || value.toString().trim() === '')) {
        newErrors[field.id] = `${stripFormattedLabelSyntax(field.label)} is required`;
        return;
      }

      // Skip validation if field is empty and not required
      if (!value || value.toString().trim() === '') return;

      // Type-specific validation
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          newErrors[field.id] = 'Please enter a valid email address';
        }
      }

      if (field.type === 'phone') {
        const phoneRegex = /^\+?[1-9]\d{0,15}$/;
        if (!phoneRegex.test(value.replace(/\s/g, ''))) {
          newErrors[field.id] = 'Please enter a valid phone number';
        }
      }

      // Validation rules
      if (field.validation) {
        const stringValue = value.toString();

        if (field.validation.minLength && stringValue.length < field.validation.minLength) {
          newErrors[field.id] = `Minimum length is ${field.validation.minLength} characters`;
        }

        if (field.validation.maxLength && stringValue.length > field.validation.maxLength) {
          newErrors[field.id] = `Maximum length is ${field.validation.maxLength} characters`;
        }

        if (field.type === 'number') {
          const numValue = parseFloat(value);
          if (field.validation.min !== undefined && numValue < field.validation.min) {
            newErrors[field.id] = `Minimum value is ${field.validation.min}`;
          }
          if (field.validation.max !== undefined && numValue > field.validation.max) {
            newErrors[field.id] = `Maximum value is ${field.validation.max}`;
          }
        }

        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(stringValue)) {
            newErrors[field.id] = 'Please enter a valid format';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm() && onSubmit) {
      onSubmit(formData);
    }
  };

  /**
   * Markup only. The `baseInputClass` template this replaced - and the second
   * copy of `focus:ring-blue-500` that came with it - existed because there was
   * no shared control to reach for. Every control below now resolves its height,
   * focus ring, error treatment and aria wiring from the primitives, so a form
   * cannot come out 42px tall in one file and 56px in the next.
   */
  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';
    const label = stripFormattedLabelSyntax(field.label);
    // The primitives' disabled treatment is the control's own; the container
    // tint only applies to the grouped controls below, which have no primitive.
    const disabledControl = disabled ? 'bg-surface-container-low' : '';

    switch (field.type) {
      case 'spacer':
        return (
          <div className="py-2">
            <div className="h-0.5 w-full rounded-full bg-surface-container" />
          </div>
        );
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
      case 'date':
        return (
          <Input
            type={field.type}
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={disabledControl}
          />
        );

      case 'textarea':
        return (
          <Textarea
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
            rows={4}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={disabledControl}
          />
        );

      case 'select':
        return (
          <Select
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            disabled={disabled}
          >
            <option value="">{field.placeholder || `Select ${stripFormattedLabelSyntax(field.label).toLowerCase()}`}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );

      case 'multiselect':
        return (
          <Field
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
          >
            {({ describedBy }) => (
              <div
                className={`space-y-2xs ${disabled ? 'opacity-50' : ''}`}
                role="group"
                aria-describedby={describedBy}
              >
                {field.options?.map((option, index) => (
                  <label
                    key={index}
                    className="flex min-h-control cursor-pointer items-center gap-3 rounded-md border border-outline-variant bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low"
                  >
                    <input
                      type="checkbox"
                      checked={(value || []).includes(option)}
                      onChange={(e) => {
                        const currentValues = value || [];
                        if (e.target.checked) {
                          handleInputChange(field.id, [...currentValues, option]);
                        } else {
                          handleInputChange(field.id, currentValues.filter((v: string) => v !== option));
                        }
                      }}
                      disabled={disabled}
                      className="h-4 w-4 shrink-0 rounded accent-primary"
                    />
                    <span className="min-w-0 text-base text-on-surface">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        );

      case 'radio':
        return (
          <Field
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
          >
            {({ describedBy }) => (
              <div
                className={`space-y-2xs ${disabled ? 'opacity-50' : ''}`}
                role="radiogroup"
                aria-describedby={describedBy}
              >
                {field.options?.map((option, index) => (
                  <label
                    key={index}
                    className="flex min-h-control cursor-pointer items-center gap-3 rounded-md border border-outline-variant bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low"
                  >
                    <input
                      type="radio"
                      name={field.id}
                      value={option}
                      checked={value === option}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      disabled={disabled}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 text-base text-on-surface">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        );

      case 'checkbox':
        // The label is the control's accessible name, so it stays a <label> and
        // keeps rendering the authored formatting.
        return (
          <div>
            <label className={`flex min-h-control cursor-pointer items-start gap-3 rounded-md border border-outline-variant bg-surface p-md transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${disabled ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={value === true}
                onChange={(e) => handleInputChange(field.id, e.target.checked)}
                disabled={disabled}
                className="mt-1 h-4 w-4 shrink-0 rounded accent-primary"
              />
              <span className="min-w-0 text-base text-on-surface">
                {field.placeholder || <FormattedLabelText value={field.label} />}
              </span>
            </label>
            {errors[field.id] && (
              <p role="alert" className="mt-2xs text-sm text-error">{errors[field.id]}</p>
            )}
            {field.description && !errors[field.id] && (
              <p className="mt-2xs text-sm text-on-surface-variant">{field.description}</p>
            )}
          </div>
        );

      case 'rating':
        return (
          <div>
            <p className="mb-2xs text-sm font-medium text-on-surface">
              {label}
              {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
            </p>
            <div className={`flex flex-wrap items-center gap-3xs ${disabled ? 'opacity-50' : ''}`} role="group" aria-label={label}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Button
                  key={star}
                  variant="text"
                  disabled={disabled}
                  aria-label={`Rate ${star} out of 5`}
                  aria-pressed={value === star}
                  onClick={() => handleInputChange(field.id, star)}
                  className={`min-w-[48px] text-2xl leading-none ${
                    value >= star ? 'text-warning-amber' : 'text-outline'
                  }`}
                >
                  <StarIcon className="h-6 w-6" aria-hidden="true" />
                </Button>
              ))}
            </div>
            {value > 0 && (
              <p className="mt-2xs text-sm text-on-surface-variant">
                {value} out of 5
              </p>
            )}
            {errors[field.id] && (
              <p role="alert" className="mt-2xs text-sm text-error">{errors[field.id]}</p>
            )}
            {field.description && !errors[field.id] && (
              <p className="mt-2xs text-sm text-on-surface-variant">{field.description}</p>
            )}
          </div>
        );

      case 'file':
        return (
          <Input
            type="file"
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
            onChange={(e) => {
              const file = e.target.files?.[0];
              handleInputChange(field.id, file);
            }}
            disabled={disabled}
            className={disabledControl}
          />
        );

      default:
        return (
          <Input
            type="text"
            label={label}
            required={field.required}
            error={errors[field.id]}
            hint={field.description}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={disabledControl}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="grid grid-cols-1 gap-x-md gap-y-8 md:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className={
              field.gridSize === 'full' || field.type === 'spacer'
                ? 'md:col-span-2'
                : field.type === 'checkbox' || field.type === 'multiselect' || field.type === 'radio'
                ? 'md:col-span-2'
                : 'col-span-1'
            }
          >
            {renderField(field)}
          </div>
        ))}
      </div>

      {onSubmit && (
        <div className="mt-8">
          <Button type="submit" fullWidth disabled={disabled}>
            {submitButtonText}
          </Button>
        </div>
      )}
    </form>
  );
};

export default FormRenderer;
