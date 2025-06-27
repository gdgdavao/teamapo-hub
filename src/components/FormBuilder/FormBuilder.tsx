import React, { useState } from 'react';
import { 
  PlusIcon, 
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'radio' | 'rating' | 'file' | 'date' | 'number';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  description?: string;
  gridSize?: 'full' | 'half';
}

interface FormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  title?: string;
  description?: string;
  showPreview?: boolean;
}

const FormBuilder: React.FC<FormBuilderProps> = ({
  fields,
  onChange,
  title = "Form Builder",
  description = "Design your custom form",
  showPreview = true
}) => {
  const [previewMode, setPreviewMode] = useState(false);

  const fieldTypes = [
    { type: 'text', label: 'Text Input', icon: '📝' },
    { type: 'email', label: 'Email', icon: '📧' },
    { type: 'phone', label: 'Phone', icon: '📱' },
    { type: 'number', label: 'Number', icon: '🔢' },
    { type: 'date', label: 'Date', icon: '📅' },
    { type: 'textarea', label: 'Text Area', icon: '📄' },
    { type: 'select', label: 'Dropdown', icon: '📋' },
    { type: 'multiselect', label: 'Multi-Select', icon: '☑️' },
    { type: 'radio', label: 'Radio Buttons', icon: '🔘' },
    { type: 'checkbox', label: 'Checkbox', icon: '✅' },
    { type: 'rating', label: 'Rating', icon: '⭐' },
    { type: 'file', label: 'File Upload', icon: '📎' }
  ];

  const addField = (fieldType?: FormField['type']) => {
    const newField: FormField = {
      id: Date.now().toString(),
      type: fieldType || 'text',
      label: 'New Field',
      required: false,
      gridSize: 'full'
    };

    onChange([...fields, newField]);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    onChange(fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const removeField = (fieldId: string) => {
    onChange(fields.filter(field => field.id !== fieldId));
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(field => field.id === fieldId);
    
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === fields.length - 1)
    ) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newFields = [...fields];
    [newFields[currentIndex], newFields[newIndex]] = [newFields[newIndex], newFields[currentIndex]];

    onChange(newFields);
  };

  const renderFormField = (field: FormField, isPreview: boolean = false) => {
    if (isPreview) {
      switch (field.type) {
        case 'textarea':
          return (
            <textarea
              placeholder={field.placeholder}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
              rows={3}
            />
          );
        case 'select':
          return (
            <select disabled className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50">
              <option>{field.placeholder || 'Select an option'}</option>
              {field.options?.map((option, index) => (
                <option key={index}>{option}</option>
              ))}
            </select>
          );
        case 'radio':
          return (
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input type="radio" disabled className="mr-2" />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          );
        case 'multiselect':
          return (
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input type="checkbox" disabled className="mr-2" />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          );
        case 'checkbox':
          return (
            <label className="flex items-center">
              <input type="checkbox" disabled className="mr-2" />
              <span className="text-sm">{field.placeholder || field.label}</span>
            </label>
          );
        case 'rating':
          return (
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className="text-2xl text-gray-300">⭐</span>
              ))}
            </div>
          );
        default:
          return (
            <input
              type={field.type}
              placeholder={field.placeholder}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
            />
          );
      }
    }
    return null;
  };

  if (previewMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title} Preview</h3>
            <p className="text-gray-600">Preview how your form will look to users</p>
          </div>
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Back to Editor
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4">{title}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className={field.gridSize === 'full' ? 'md:col-span-2' : 'col-span-1'}
              >
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                {renderFormField(field, true)}
                {field.description && (
                  <p className="mt-1 text-xs text-gray-500">{field.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>
        
        <div className="flex space-x-2">
          {showPreview && (
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <EyeIcon className="w-4 h-4 mr-2" />
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={() => addField()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Field
          </button>
        </div>
      </div>

      {/* Field Types Palette */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Add Field Types</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {fieldTypes.map((fieldType) => (
            <button
              key={fieldType.type}
              type="button"
              onClick={() => addField(fieldType.type as FormField['type'])}
              className="flex flex-col items-center p-2 text-xs bg-white border border-gray-200 rounded hover:border-blue-300 hover:bg-blue-50"
            >
              <span className="text-lg mb-1">{fieldType.icon}</span>
              <span className="text-center">{fieldType.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <h4 className="text-lg font-medium text-gray-900 mb-2">No fields added yet</h4>
            <p className="text-gray-600 mb-4">Start building your form by adding fields above</p>
            <button
              type="button"
              onClick={() => addField()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Field
            </button>
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">#{index + 1}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {fieldTypes.find(ft => ft.type === field.type)?.icon} {field.type}
                  </span>
                  {field.required && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Required</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => moveField(field.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Move up"
                  >
                    <ArrowUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(field.id, 'down')}
                    disabled={index === fields.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Move down"
                  >
                    <ArrowDownIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="p-1 text-red-400 hover:text-red-600"
                    title="Remove field"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as FormField['type'] })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {fieldTypes.map((fieldType) => (
                      <option key={fieldType.type} value={fieldType.type}>
                        {fieldType.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Field label"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Placeholder text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Size</label>
                  <select
                    value={field.gridSize}
                    onChange={(e) => updateField(field.id, { gridSize: e.target.value as 'full' | 'half' })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="full">Full Width</option>
                    <option value="half">Half Width</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={field.description || ''}
                    onChange={(e) => updateField(field.id, { description: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Optional help text for this field"
                  />
                </div>

                <div className="md:col-span-2 flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Required field</span>
                  </label>
                </div>
              </div>

              {/* Options for select/multiselect/radio fields */}
              {['select', 'multiselect', 'radio'].includes(field.type) && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                  <div className="space-y-2">
                    {(field.options || []).map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...(field.options || [])];
                            newOptions[optionIndex] = e.target.value;
                            updateField(field.id, { options: newOptions });
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Option ${optionIndex + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = (field.options || []).filter((_, i) => i !== optionIndex);
                            updateField(field.id, { options: newOptions });
                          }}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = [...(field.options || []), ''];
                        updateField(field.id, { options: newOptions });
                      }}
                      className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Add Option
                    </button>
                  </div>
                </div>
              )}

              {/* Validation rules */}
              {['text', 'textarea', 'number'].includes(field.type) && (
                <div className="mt-4">
                  <details className="text-sm">
                    <summary className="font-medium text-gray-700 cursor-pointer">Validation Rules</summary>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {field.type !== 'number' && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Min Length</label>
                            <input
                              type="number"
                              value={field.validation?.minLength || ''}
                              onChange={(e) => updateField(field.id, {
                                validation: {
                                  ...field.validation,
                                  minLength: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              })}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              placeholder="Min characters"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Max Length</label>
                            <input
                              type="number"
                              value={field.validation?.maxLength || ''}
                              onChange={(e) => updateField(field.id, {
                                validation: {
                                  ...field.validation,
                                  maxLength: e.target.value ? parseInt(e.target.value) : undefined
                                }
                              })}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              placeholder="Max characters"
                            />
                          </div>
                        </>
                      )}
                      {field.type === 'number' && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Min Value</label>
                            <input
                              type="number"
                              value={field.validation?.min || ''}
                              onChange={(e) => updateField(field.id, {
                                validation: {
                                  ...field.validation,
                                  min: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                              })}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Max Value</label>
                            <input
                              type="number"
                              value={field.validation?.max || ''}
                              onChange={(e) => updateField(field.id, {
                                validation: {
                                  ...field.validation,
                                  max: e.target.value ? parseFloat(e.target.value) : undefined
                                }
                              })}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FormBuilder;
