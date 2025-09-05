import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DocumentTextIcon,
  EyeIcon,
  PencilIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
  CheckIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import FormService from '../../services/formService';

interface FormField {
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

interface CustomForm {
  id: string;
  name: string;
  type: 'registration' | 'feedback';
  description: string;
  fields: FormField[];
  isActive: boolean;
  createdAt: string;
  usageCount: number;
  eventId?: string;
  eventTitle?: string;
}

const AdminFormsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'forms' | 'builder'>('forms');
  const [editingForm, setEditingForm] = useState<CustomForm | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // Form builder state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<'registration' | 'feedback'>('registration');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);

  // Load events from API
  useEffect(() => {
    const fetchEvents = async () => {
      try {
  const eventsData = await FormService.getAllEvents();
  setEvents(eventsData);
      } catch (error) {
        console.error('Error fetching events:', error);
        setEvents([]);
      }
    };

    fetchEvents();

    const fetchForms = async () => {
      try {
  const formsData = await FormService.getAllForms();
  setForms(formsData as any);
      } catch (error) {
        console.error('Error fetching forms:', error);
        setForms([]);
      }
    };

    fetchForms();
  }, []);

  const refreshForms = async () => {
    try {
      const formsData = await FormService.getAllForms();
      setForms(formsData as any);
    } catch (error) {
      console.error('Error refreshing forms:', error);
    }
  };

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

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: Date.now().toString(),
      type,
      label: `New ${type} field`,
      required: false,
      gridSize: 'full'
    };

    if (type === 'select' || type === 'multiselect' || type === 'radio') {
      newField.options = ['Option 1', 'Option 2', 'Option 3'];
    }

    setFormFields([...formFields, newField]);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFormFields(fields => 
      fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
  };

  const removeField = (fieldId: string) => {
    setFormFields(fields => fields.filter(field => field.id !== fieldId));
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    setFormFields(fields => {
      const index = fields.findIndex(f => f.id === fieldId);
      if (
        (direction === 'up' && index > 0) ||
        (direction === 'down' && index < fields.length - 1)
      ) {
        const newFields = [...fields];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
        return newFields;
      }
      return fields;
    });
  };

  const generateAIForm = () => {
    const templates = {
      registration: [
        { id: '1', type: 'text' as const, label: 'Full Name', required: true, gridSize: 'full' as const },
        { id: '2', type: 'email' as const, label: 'Email Address', required: true, gridSize: 'half' as const },
        { id: '3', type: 'phone' as const, label: 'Phone Number', required: true, gridSize: 'half' as const },
        { id: '4', type: 'text' as const, label: 'Organization/Company', required: false, gridSize: 'full' as const },
        { id: '5', type: 'select' as const, label: 'Experience Level', required: true, options: ['Beginner', 'Intermediate', 'Advanced'], gridSize: 'half' as const },
        { id: '6', type: 'multiselect' as const, label: 'Areas of Interest', required: false, options: ['Frontend Development', 'Backend Development', 'DevOps', 'Mobile Development', 'Data Science'], gridSize: 'half' as const },
        { id: '7', type: 'textarea' as const, label: 'What do you hope to learn?', required: false, gridSize: 'full' as const },
        { id: '8', type: 'checkbox' as const, label: 'I agree to receive event updates', required: false, gridSize: 'full' as const }
      ],
      feedback: [
        { id: '1', type: 'rating' as const, label: 'Overall Event Rating', required: true, gridSize: 'full' as const },
        { id: '2', type: 'rating' as const, label: 'Speaker/Instructor Quality', required: true, gridSize: 'half' as const },
        { id: '3', type: 'rating' as const, label: 'Content Relevance', required: true, gridSize: 'half' as const },
        { id: '4', type: 'rating' as const, label: 'Event Organization', required: true, gridSize: 'half' as const },
        { id: '5', type: 'rating' as const, label: 'Venue/Platform Quality', required: true, gridSize: 'half' as const },
        { id: '6', type: 'select' as const, label: 'Would you recommend this event?', required: true, options: ['Definitely', 'Probably', 'Maybe', 'Probably Not', 'Definitely Not'], gridSize: 'full' as const },
        { id: '7', type: 'textarea' as const, label: 'What did you like most about the event?', required: false, gridSize: 'full' as const },
        { id: '8', type: 'textarea' as const, label: 'What could be improved?', required: false, gridSize: 'full' as const },
        { id: '9', type: 'textarea' as const, label: 'Additional comments or suggestions', required: false, gridSize: 'full' as const },
        { id: '10', type: 'checkbox' as const, label: 'I would like to attend future events', required: false, gridSize: 'full' as const }
      ]
    };

    setFormFields(templates[formType]);
  };

  const saveForm = async () => {
    if (!formName.trim() || formFields.length === 0) {
      alert('Please provide a form name and add at least one field.');
      return;
    }

    const basePayload = {
      name: formName,
      type: formType,
      description: formDescription,
      fields: formFields,
      isActive: true,
      eventId: selectedEvent || undefined,
      eventTitle: selectedEvent ? events.find(e => e.id === selectedEvent)?.title : undefined
    } as const;

    try {
      if (editingForm?.id) {
        await FormService.updateForm(editingForm.id, basePayload as any);
      } else {
        await FormService.createForm(basePayload as any);
      }
      await refreshForms();
    } catch (err) {
      console.error('Failed to save form:', err);
      alert('Failed to save form. Please try again.');
      return;
    }

    // Reset form
    setFormName('');
    setFormDescription('');
    setFormType('registration');
    setSelectedEvent('');
    setFormFields([]);
    setEditingForm(null);
    setActiveTab('forms');
  };

  const editForm = (form: CustomForm) => {
    setEditingForm(form);
    setFormName(form.name);
    setFormDescription(form.description);
    setFormType(form.type);
    setSelectedEvent(form.eventId || '');
    setFormFields(form.fields);
    setActiveTab('builder');
  };

  const toggleFormStatus = async (formId: string) => {
    const target = forms.find(f => f.id === formId);
    if (!target) return;
    const next = !target.isActive;
    setForms(prev => prev.map(f => f.id === formId ? { ...f, isActive: next } : f));
    try {
      await FormService.updateForm(formId, { isActive: next } as any);
    } catch (err) {
      console.error('Failed to update status:', err);
      setForms(prev => prev.map(f => f.id === formId ? { ...f, isActive: !next } : f));
      alert('Failed to update form status.');
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this form?')) return;
    const prev = forms;
    setForms(prev.filter(f => f.id !== formId));
    try {
      await FormService.deleteForm(formId);
    } catch (err) {
      console.error('Failed to delete form:', err);
      alert('Failed to delete form.');
      setForms(prev);
    }
  };

  const renderFieldPreview = (field: FormField) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500";
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <input
            type={field.type === 'phone' ? 'tel' : field.type}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={baseClasses}
            disabled
          />
        );
      case 'date':
        return <input type="date" className={baseClasses} disabled />;
      case 'textarea':
        return (
          <textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            rows={3}
            className={baseClasses}
            disabled
          />
        );
      case 'select':
        return (
          <select className={baseClasses} disabled>
            <option>Select an option</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.slice(0, 3).map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" disabled />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.slice(0, 3).map((option, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input type="radio" name={field.id} className="text-primary-600" disabled />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <label className="flex items-center space-x-2">
            <input type="checkbox" className="rounded text-primary-600" disabled />
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        );
      case 'rating':
        return (
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" className="text-yellow-400" disabled>
                ⭐
              </button>
            ))}
          </div>
        );
      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <div className="text-gray-400">
              📎 Upload file
            </div>
          </div>
        );
      default:
        return <div className="text-gray-500">Unknown field type</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Form Builder</h1>
        <p className="text-gray-600 mt-2">
          Create and manage custom registration and feedback forms
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'forms', name: 'My Forms', icon: ClipboardDocumentListIcon },
            { id: 'builder', name: 'Form Builder', icon: DocumentTextIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Forms List Tab */}
      {activeTab === 'forms' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Forms</h2>
            <button
              onClick={() => setActiveTab('builder')}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create New Form</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <div key={form.id} className="dashboard-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {form.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {form.description}
                    </p>
                    {form.eventTitle && (
                      <p className="text-xs text-primary-600 font-medium">
                        📅 {form.eventTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      form.type === 'registration' 
                        ? 'bg-primary-100 text-primary-800' 
                        : 'bg-accent-100 text-accent-800'
                    }`}>
                      {form.type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      form.isActive 
                        ? 'bg-success-100 text-success-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {form.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{form.fields.length} fields</span>
                  <span>{form.usageCount} responses</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => editForm(form)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingForm(form);
                        setPreviewMode(true);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteForm(form.id)}
                      className="text-secondary-500 hover:text-secondary-700"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleFormStatus(form.id)}
                    className={`text-xs font-medium ${
                      form.isActive 
                        ? 'text-secondary-600 hover:text-secondary-700' 
                        : 'text-success-600 hover:text-success-700'
                    }`}
                  >
                    {form.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Builder Tab */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Form Configuration */}
          <div className="lg:col-span-1">
            <div className="dashboard-card mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Form Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter form name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Describe the form's purpose"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Form Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'registration' | 'feedback')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="registration">Registration Form</option>
                    <option value="feedback">Feedback Form</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Associated Event (Optional)
                  </label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No specific event</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={generateAIForm}
                  className="w-full btn-secondary flex items-center justify-center space-x-2"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>Generate AI Template</span>
                </button>
              </div>
            </div>

            {/* Field Types */}
            <div className="dashboard-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Fields</h3>
              <div className="grid grid-cols-1 gap-2">
                {fieldTypes.map((fieldType) => (
                  <button
                    key={fieldType.type}
                    onClick={() => addField(fieldType.type as FormField['type'])}
                    className="flex items-center space-x-3 p-3 text-left border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <span className="text-lg">{fieldType.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{fieldType.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Builder */}
          <div className="lg:col-span-2">
            <div className="dashboard-card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Form Builder</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      previewMode 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <EyeIcon className="h-4 w-4 inline mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={saveForm}
                    disabled={!formName.trim() || formFields.length === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4 inline mr-1" />
                    Save Form
                  </button>
                </div>
              </div>

              {formFields.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p>No fields added yet</p>
                  <p className="text-sm">Add fields from the sidebar to start building your form</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formFields.map((field, index) => (
                    <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                      {!previewMode ? (
                        // Edit mode
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 flex-1">
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                className="font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                              />
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-sm text-gray-600">Required</span>
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => moveField(field.id, 'up')}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                              >
                                <ArrowUpIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => moveField(field.id, 'down')}
                                disabled={index === formFields.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                              >
                                <ArrowDownIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => removeField(field.id)}
                                className="p-1 text-secondary-500 hover:text-secondary-700"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {(field.type === 'select' || field.type === 'multiselect' || field.type === 'radio') && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Options (one per line)
                              </label>
                              <textarea
                                value={field.options?.join('\n') || ''}
                                onChange={(e) => updateField(field.id, { 
                                  options: e.target.value.split('\n').filter(opt => opt.trim()) 
                                })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Placeholder (Optional)
                            </label>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Enter placeholder text"
                            />
                          </div>
                        </div>
                      ) : (
                        // Preview mode
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.label}
                            {field.required && <span className="text-secondary-500 ml-1">*</span>}
                          </label>
                          {renderFieldPreview(field)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Form Preview */}
          <div className="lg:col-span-1">
            <div className="dashboard-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Preview</h3>
              
              {formName && (
                <div className="mb-4">
                  <h4 className="text-xl font-bold text-gray-900">{formName}</h4>
                  {formDescription && (
                    <p className="text-sm text-gray-600 mt-1">{formDescription}</p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {formFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-secondary-500 ml-1">*</span>}
                    </label>
                    <div className="text-xs">
                      {renderFieldPreview(field)}
                    </div>
                  </div>
                ))}
                
                {formFields.length > 0 && (
                  <button className="w-full btn-primary mt-4" disabled>
                    Submit Form
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewMode && editingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{editingForm.name}</h2>
              <button
                onClick={() => setPreviewMode(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {editingForm.description && (
              <p className="text-gray-600 mb-6">{editingForm.description}</p>
            )}

            <div className="space-y-6">
              {editingForm.fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-secondary-500 ml-1">*</span>}
                  </label>
                  {renderFieldPreview(field)}
                </div>
              ))}
              
              <button className="w-full btn-primary" disabled>
                Submit Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFormsPage;
