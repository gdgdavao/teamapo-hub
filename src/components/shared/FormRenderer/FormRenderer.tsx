import React, { useState } from 'react';
import { FormField } from '../FormBuilder';
import FormattedLabelText, { stripFormattedLabelSyntax } from '../FormattedLabelText';

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
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
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

  const renderField = (field: FormField) => {
    const value = formData[field.id] || '';
    const hasError = !!errors[field.id];
    
    const baseInputClass = `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
      hasError 
        ? 'border-red-300 focus:ring-red-500' 
        : 'border-gray-300'
    } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`;

    switch (field.type) {
      case 'spacer':
        return (
          <div className="py-2">
            <div className="h-0.5 w-full rounded-full bg-gray-200" />
          </div>
        );
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
      case 'date':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            rows={4}
            className={`${baseInputClass} resize-none`}
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          >
            <option value="">{field.placeholder || `Select ${stripFormattedLabelSyntax(field.label).toLowerCase()}`}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'multiselect':
        return (
          <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
      
      case 'radio':
        return (
          <div className={`space-y-2 ${disabled ? 'opacity-50' : ''}`}>
            {field.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  name={field.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  disabled={disabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
      
      case 'checkbox':
        return (
          <label className={`flex items-start ${disabled ? 'opacity-50' : ''}`}>
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleInputChange(field.id, e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
            />
            <span className="ml-2 text-gray-700">
              {field.placeholder || field.label}
            </span>
          </label>
        );
      
      case 'rating':
        return (
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleInputChange(field.id, star)}
                disabled={disabled}
                className={`text-3xl transition-colors focus:outline-none ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
                } ${
                  value >= star ? 'text-yellow-400' : 'text-gray-300'
                }`}
                aria-label={`Rate ${star} out of 5`}
              >
                ★
              </button>
            ))}
            {value > 0 && (
              <span className="ml-3 text-sm text-gray-600 self-center">
                {value} out of 5
              </span>
            )}
          </div>
        );
      
      case 'file':
        return (
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              handleInputChange(field.id, file);
            }}
            disabled={disabled}
            className={baseInputClass}
          />
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className={field.gridSize === 'full' || field.type === 'spacer' ? 'md:col-span-2' : 'col-span-1'}
          >
            {field.type !== 'spacer' && (
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <FormattedLabelText value={field.label} />
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
            
            {renderField(field)}
            
            {errors[field.id] && (
              <p className="mt-2 text-sm text-red-600">{errors[field.id]}</p>
            )}
            
            {field.description && !errors[field.id] && (
              <p className="mt-2 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        ))}
      </div>

      {onSubmit && (
        <div className="mt-8">
          <button
            type="submit"
            disabled={disabled}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {submitButtonText}
          </button>
        </div>
      )}
    </form>
  );
};

export default FormRenderer;
