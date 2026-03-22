import React, { useRef, useState } from 'react';
import { 
  PlusIcon, 
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XCircleIcon,
  EyeIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import FormattedLabelText from '../FormattedLabelText';

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'radio' | 'rating' | 'file' | 'date' | 'number' | 'spacer';
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
  const labelTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

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
    { type: 'file', label: 'File Upload', icon: '📎' },
    { type: 'spacer', label: 'Spacer', icon: '➖' }
  ];

  const addField = (fieldType?: FormField['type']) => {
    const selectedType = fieldType || 'text';
    const newField: FormField = {
      id: Date.now().toString(),
      type: selectedType,
      label: selectedType === 'spacer' ? 'Section Spacer' : 'New Field',
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
        case 'spacer':
          return (
            <div className="py-4">
              <div className="h-0.5 w-full rounded-full bg-gray-200" />
            </div>
          );
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

  const isSpacerField = (field: FormField) => field.type === 'spacer';

  const applyLabelFormatting = (
    fieldId: string,
    formatType: 'bold' | 'italic' | 'underline' | 'link'
  ) => {
    const textarea = labelTextareaRefs.current[fieldId];
    const targetField = fields.find((field) => field.id === fieldId);

    if (!textarea || !targetField) return;

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? 0;
    const selectedText = targetField.label.slice(selectionStart, selectionEnd);
    const hasSelection = selectionEnd > selectionStart;

    let replacementText = '';

    if (formatType === 'bold') {
      replacementText = hasSelection ? `**${selectedText}**` : '**bold text**';
    } else if (formatType === 'italic') {
      replacementText = hasSelection ? `*${selectedText}*` : '*italic text*';
    } else if (formatType === 'underline') {
      replacementText = hasSelection ? `__${selectedText}__` : '__underlined text__';
    } else {
      const defaultLabel = hasSelection ? selectedText : 'link text';
      const inputUrl = window.prompt('Enter a link URL (https://...)', 'https://');

      if (!inputUrl) return;

      const trimmedUrl = inputUrl.trim();
      replacementText = `[${defaultLabel}](${trimmedUrl})`;
    }

    const nextLabel = `${targetField.label.slice(0, selectionStart)}${replacementText}${targetField.label.slice(selectionEnd)}`;

    updateField(fieldId, { label: nextLabel });

    const nextCursorPosition = selectionStart + replacementText.length;
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
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

        <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold mb-4">{title}</h4>
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 md:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.id}
                className={`space-y-2 ${field.gridSize === 'full' || isSpacerField(field) ? 'md:col-span-2' : 'col-span-1'}`}
              >
                {!isSpacerField(field) && (
                  <label className="block text-sm font-medium text-gray-700">
                    <FormattedLabelText value={field.label} />
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                )}
                {renderFormField(field, true)}
                {field.description && (
                  <p className="text-xs text-gray-500">{field.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-violet-100">{description}</p>
          </div>
          
          <div className="flex space-x-2">
            {showPreview && (
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className="flex items-center rounded-lg border border-violet-200/50 bg-white/10 px-4 py-2 text-white hover:bg-white/20"
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Preview
              </button>
            )}
            <button
              type="button"
              onClick={() => addField()}
              className="flex items-center rounded-lg bg-white px-4 py-2 text-violet-700 hover:bg-violet-100"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Field
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-violet-700">Field Types</h4>
          <p className="text-sm text-gray-600">Click to quickly add a field.</p>
        </div>
      </div>

      {/* Field Types Palette */}
      <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
          {fieldTypes.map((fieldType) => (
            <button
              key={fieldType.type}
              type="button"
              onClick={() => addField(fieldType.type as FormField['type'])}
              className="flex items-center gap-2 rounded-full border border-violet-200 px-3 py-2 text-left text-xs text-violet-700 hover:bg-violet-50"
            >
              <span className="text-base">{fieldType.icon}</span>
              <span>{fieldType.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {fields.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-violet-300 bg-white py-12 text-center">
            <h4 className="text-lg font-medium text-gray-900 mb-2">No fields added yet</h4>
            <p className="text-gray-600 mb-4">Start building your form by adding fields above</p>
            <button
              type="button"
              onClick={() => addField()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700"
            >
              Add Your First Field
            </button>
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">#{index + 1}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {fieldTypes.find(ft => ft.type === field.type)?.icon} {field.type}
                  </span>
                  {field.required && !isSpacerField(field) && (
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyLabelFormatting(field.id, 'bold')}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => applyLabelFormatting(field.id, 'italic')}
                      className="rounded border border-gray-300 px-2 py-1 text-xs italic text-gray-700 hover:bg-gray-50"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => applyLabelFormatting(field.id, 'underline')}
                      className="rounded border border-gray-300 px-2 py-1 text-xs underline text-gray-700 hover:bg-gray-50"
                    >
                      U
                    </button>
                    <button
                      type="button"
                      onClick={() => applyLabelFormatting(field.id, 'link')}
                      className="inline-flex items-center rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <LinkIcon className="mr-1 h-3.5 w-3.5" />
                      Link
                    </button>
                  </div>
                  <textarea
                    ref={(element) => {
                      labelTextareaRefs.current[field.id] = element;
                    }}
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Field label with formatting"
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Supports new lines, bold (**text**), italic (*text*), underline (__text__), and links ([text](https://...)).
                  </p>
                </div>

                {!isSpacerField(field) && (
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
                )}

                {!isSpacerField(field) && (
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
                )}

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

                {!isSpacerField(field) && (
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
                )}
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
