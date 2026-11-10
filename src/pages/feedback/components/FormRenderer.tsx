import React, { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { FormField } from '../../../types';
import FormattedLabelText, { stripFormattedLabelSyntax } from '../../../components/FormattedLabelText';
import { Button, Badge, Input, Select, Textarea } from '../../../components/UI';
import { isOtherOption, formatOtherResponse, parseOtherResponse } from '../../../utils/formResponses';

const isMultiCheckboxField = (field: FormField): boolean =>
  field.type === 'multiselect' ||
  (field.type === 'checkbox' && Array.isArray(field.options) && field.options.length > 0);

const RATING_FEEDBACK: Record<number, { text: string; tone: 'danger' | 'warning' | 'info' | 'success' }> = {
  1: { text: 'Needs Improvement', tone: 'danger' },
  2: { text: 'Fair', tone: 'warning' },
  3: { text: 'Good', tone: 'info' },
  4: { text: 'Great!', tone: 'success' },
  5: { text: 'Outstanding! 🎉', tone: 'success' },
};

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
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hoveredRatings, setHoveredRatings] = useState<Record<string, number>>({});
  const [animatingRating, setAnimatingRating] = useState<string | null>(null);

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
      const cleanLabel = stripFormattedLabelSyntax(field.label);

      // Required field validation
      if (field.required) {
        if (isMultiCheckboxField(field)) {
          if (!Array.isArray(value) || value.length === 0) {
            newErrors[field.id] = `${cleanLabel} is required`;
            return;
          }
        } else if (field.type === 'checkbox') {
          if (value !== true) {
            newErrors[field.id] = `${cleanLabel} is required`;
            return;
          }
        } else if (!value || value.toString().trim() === '') {
          newErrors[field.id] = `${cleanLabel} is required`;
          return;
        }
      }

      // Check required "Other" text
      if (value) {
        let selectedOtherVal: string | undefined;
        if (typeof value === 'string' && isOtherOption(value)) {
          selectedOtherVal = value;
        } else if (Array.isArray(value)) {
          selectedOtherVal = value.find((v: string) => isOtherOption(v));
        }

        if (selectedOtherVal) {
          const { customText } = parseOtherResponse(selectedOtherVal);
          if (field.required && !customText.trim()) {
            newErrors[field.id] = `Please specify your answer for ${cleanLabel}`;
            return;
          }
        }
      }

      // Skip validation if field is empty and not required
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (!Array.isArray(value) && value.toString().trim() === '')
      ) {
        return;
      }

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
    const value = formData[field.id] ?? (isMultiCheckboxField(field) ? [] : '');
    const label = stripFormattedLabelSyntax(field.label);
    // The primitives' disabled treatment is the control's own; the container
    // tint only applies to the grouped controls below, which have no primitive.
    const disabledControl = disabled ? 'bg-surface-container-low' : '';
    const effectiveType = isMultiCheckboxField(field) ? 'multiselect' : field.type;
    const errorId = errors[field.id] ? `field-${field.id}-error` : undefined;
    const hintId = !errors[field.id] && field.description ? `field-${field.id}-hint` : undefined;
    const groupDescribedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    switch (effectiveType) {
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

      case 'select': {
        const isSelectedOther = isOtherOption(value);
        return (
          <div className="space-y-2xs">
            <Select
              label={label}
              required={field.required}
              error={errors[field.id]}
              hint={field.description}
              value={isSelectedOther ? (field.options?.find(opt => isOtherOption(opt)) || 'Other...') : (value || '')}
              onChange={(e) => {
                const selectedVal = e.target.value;
                if (isOtherOption(selectedVal)) {
                  handleInputChange(field.id, formatOtherResponse(selectedVal, otherTexts[field.id]));
                } else {
                  handleInputChange(field.id, selectedVal);
                }
              }}
              disabled={disabled}
            >
              <option value="">{field.placeholder || `Select ${stripFormattedLabelSyntax(field.label).toLowerCase()}`}</option>
              {field.options?.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            {isSelectedOther && (
              <div className="pt-2xs animate-fadeIn">
                <Input
                  type="text"
                  placeholder="Please specify your answer"
                  value={otherTexts[field.id] ?? (typeof value === 'string' ? parseOtherResponse(value).customText : '')}
                  onChange={(e) => {
                    const nextText = e.target.value;
                    setOtherTexts(prev => ({ ...prev, [field.id]: nextText }));
                    handleInputChange(field.id, formatOtherResponse('Other...', nextText));
                  }}
                  disabled={disabled}
                  aria-label={`Please specify your answer for ${label}`}
                  className={disabledControl}
                />
              </div>
            )}
          </div>
        );
      }

      case 'multiselect': {
        const currentValues: string[] = Array.isArray(value) ? value : [];
        return (
          <fieldset className="space-y-2xs" aria-describedby={groupDescribedBy}>
            <legend className="mb-2xs block text-sm font-medium text-on-surface">
              {label}
              {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
            </legend>
            <div className={`space-y-2xs ${disabled ? 'opacity-50' : ''}`}>
              {field.options?.map((option, index) => {
                const isOther = isOtherOption(option);
                const isChecked = isOther
                  ? currentValues.some((v: string) => isOtherOption(v))
                  : currentValues.includes(option);
                const optionInputId = `field-${field.id}-opt-${index}`;

                return (
                  <div key={index} className="space-y-2xs">
                    <label
                      htmlFor={optionInputId}
                      className={`flex min-h-control cursor-pointer items-center gap-3 rounded-md border bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${
                        isChecked ? 'border-primary bg-primary/5' : 'border-outline-variant'
                      }`}
                    >
                      <input
                        id={optionInputId}
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const otherVal = formatOtherResponse(option, otherTexts[field.id]);
                            const next = isOther
                              ? [...currentValues.filter((v: string) => !isOtherOption(v)), otherVal]
                              : [...currentValues, option];
                            handleInputChange(field.id, next);
                          } else {
                            const next = isOther
                              ? currentValues.filter((v: string) => !isOtherOption(v))
                              : currentValues.filter((v: string) => v !== option);
                            handleInputChange(field.id, next);
                          }
                        }}
                        disabled={disabled}
                        className="h-4 w-4 shrink-0 rounded accent-primary"
                      />
                      <span className="min-w-0 text-base text-on-surface">
                        {isOther ? 'Other:' : option}
                      </span>
                    </label>
                    {isOther && isChecked && (
                      <div className="pl-7 pt-1 animate-fadeIn">
                        <Input
                          type="text"
                          placeholder="Please specify"
                          value={otherTexts[field.id] ?? (currentValues.find(isOtherOption) ? parseOtherResponse(currentValues.find(isOtherOption)).customText : '')}
                          onChange={(e) => {
                            const nextText = e.target.value;
                            setOtherTexts(prev => ({ ...prev, [field.id]: nextText }));
                            const updated = currentValues.map((item: string) =>
                              isOtherOption(item) ? formatOtherResponse(option, nextText) : item
                            );
                            handleInputChange(field.id, updated);
                          }}
                          disabled={disabled}
                          aria-label={`Please specify for ${option}`}
                          className={disabledControl}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {errors[field.id] && (
              <p id={errorId} role="alert" className="mt-2xs text-sm text-error">
                {errors[field.id]}
              </p>
            )}
            {field.description && !errors[field.id] && (
              <p id={hintId} className="mt-2xs text-sm text-on-surface-variant">
                {field.description}
              </p>
            )}
          </fieldset>
        );
      }

      case 'radio':
        return (
          <fieldset className="space-y-2xs" aria-describedby={groupDescribedBy}>
            <legend className="mb-2xs block text-sm font-medium text-on-surface">
              {label}
              {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
            </legend>
            <div
              className={`space-y-2xs ${disabled ? 'opacity-50' : ''}`}
              role="radiogroup"
              aria-describedby={groupDescribedBy}
            >
              {field.options?.map((option, index) => {
                const isOther = isOtherOption(option);
                const isChecked = isOther
                  ? isOtherOption(value)
                  : value === option;
                const radioInputId = `field-${field.id}-radio-${index}`;

                return (
                  <div key={index} className="space-y-2xs">
                    <label
                      htmlFor={radioInputId}
                      className={`flex min-h-control cursor-pointer items-center gap-3 rounded-md border bg-surface px-md py-2xs transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${
                        isChecked ? 'border-primary bg-primary/5' : 'border-outline-variant'
                      }`}
                    >
                      <input
                        id={radioInputId}
                        type="radio"
                        name={field.id}
                        value={option}
                        checked={isChecked}
                        onChange={() => {
                          const otherVal = formatOtherResponse(option, otherTexts[field.id]);
                          handleInputChange(field.id, isOther ? otherVal : option);
                        }}
                        disabled={disabled}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 text-base text-on-surface">
                        {isOther ? 'Other:' : option}
                      </span>
                    </label>
                    {isOther && isChecked && (
                      <div className="pl-7 pt-1 animate-fadeIn">
                        <Input
                          type="text"
                          placeholder="Please specify"
                          value={otherTexts[field.id] ?? (typeof value === 'string' ? parseOtherResponse(value).customText : '')}
                          onChange={(e) => {
                            const nextText = e.target.value;
                            setOtherTexts(prev => ({ ...prev, [field.id]: nextText }));
                            handleInputChange(field.id, formatOtherResponse(option, nextText));
                          }}
                          disabled={disabled}
                          aria-label={`Please specify for ${option}`}
                          className={disabledControl}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {errors[field.id] && (
              <p id={errorId} role="alert" className="mt-2xs text-sm text-error">
                {errors[field.id]}
              </p>
            )}
            {field.description && !errors[field.id] && (
              <p id={hintId} className="mt-2xs text-sm text-on-surface-variant">
                {field.description}
              </p>
            )}
          </fieldset>
        );

      case 'checkbox': {
        const checkboxInputId = `field-${field.id}-chk`;
        return (
          <div>
            <label
              htmlFor={checkboxInputId}
              className={`flex min-h-control cursor-pointer items-start gap-3 rounded-md border border-outline-variant bg-surface p-md transition-[border-color,background-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low ${disabled ? 'opacity-50' : ''}`}
            >
              <input
                id={checkboxInputId}
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
      }

      case 'rating': {
        const currentRating = typeof value === 'number' ? value : 0;
        const hoverRating = hoveredRatings[field.id] || 0;
        const activeDisplayRating = hoverRating || currentRating;
        const feedback = RATING_FEEDBACK[activeDisplayRating];

        const handleSelectRating = (star: number) => {
          if (disabled) return;
          handleInputChange(field.id, star);
          setAnimatingRating(`${field.id}-${star}`);
          setTimeout(() => {
            setAnimatingRating((prev) => (prev === `${field.id}-${star}` ? null : prev));
          }, 350);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (disabled) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = Math.min(5, (currentRating || 0) + 1);
            handleSelectRating(next);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            const prev = Math.max(1, (currentRating || 1) - 1);
            handleSelectRating(prev);
          } else if (e.key === 'Home') {
            e.preventDefault();
            handleSelectRating(1);
          } else if (e.key === 'End') {
            e.preventDefault();
            handleSelectRating(5);
          }
        };

        return (
          <div className="space-y-2xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-on-surface">
                {label}
                {field.required && <span className="ml-3xs text-error" aria-hidden="true">*</span>}
              </p>
              {activeDisplayRating > 0 && feedback && (
                <Badge
                  tone={feedback.tone}
                  className="animate-pop-in transition-[transform,opacity] motion-reduce:animate-none"
                >
                  {feedback.text}
                </Badge>
              )}
            </div>

            <div
              className={`flex flex-wrap items-center gap-1 sm:gap-2xs ${disabled ? 'opacity-50' : ''}`}
              role="radiogroup"
              aria-label={label}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={handleKeyDown}
              onMouseLeave={() => setHoveredRatings(prev => ({ ...prev, [field.id]: 0 }))}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = star <= (hoverRating || currentRating);
                const isSelected = star === currentRating;
                const isAnimating = animatingRating === `${field.id}-${star}`;

                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    disabled={disabled}
                    aria-checked={isSelected}
                    aria-label={`${star} star${star > 1 ? 's' : ''} - ${RATING_FEEDBACK[star].text}`}
                    onClick={() => handleSelectRating(star)}
                    onMouseEnter={() => !disabled && setHoveredRatings(prev => ({ ...prev, [field.id]: star }))}
                    className={`group relative flex h-12 w-12 min-h-control min-w-control items-center justify-center rounded-xl transition-[color,background-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      isLit
                        ? 'bg-warning-container/30 text-warning-amber hover:bg-warning-container/60 hover:scale-110 active:scale-95'
                        : 'text-outline-variant hover:text-outline hover:bg-surface-container hover:scale-105 active:scale-95'
                    } ${isAnimating ? 'animate-star-bounce motion-reduce:animate-none' : ''}`}
                  >
                    {isLit ? (
                      <StarIcon className="h-7 w-7 transition-transform group-hover:scale-110" aria-hidden="true" />
                    ) : (
                      <StarOutlineIcon className="h-7 w-7 transition-transform group-hover:scale-110" aria-hidden="true" />
                    )}
                    {isSelected && (
                      <span className="sr-only">Selected</span>
                    )}
                  </button>
                );
              })}
            </div>

            {errors[field.id] && (
              <p role="alert" className="mt-2xs text-sm text-error">{errors[field.id]}</p>
            )}
            {field.description && !errors[field.id] && (
              <p className="mt-2xs text-sm text-on-surface-variant">{field.description}</p>
            )}
          </div>
        );
      }

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
    <form onSubmit={handleSubmit} noValidate className={className}>
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
