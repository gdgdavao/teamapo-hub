import React, { useRef, useState, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XCircleIcon,
  LinkIcon,
  PencilSquareIcon,
  EnvelopeIcon,
  PhoneIcon,
  HashtagIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  Bars3BottomLeftIcon,
  ListBulletIcon,
  QueueListIcon,
  CheckCircleIcon,
  PaperClipIcon,
  MinusIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  InformationCircleIcon,
  ViewColumnsIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import FormattedLabelText from '../../../components/FormattedLabelText';
import type { FormField } from '../../../types';
import { Select, SegmentedControl } from '../../../components/UI';

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
  title = "Registration Form",
  description = "Customize questions for attendees registering for this event",
  showPreview: _showPreview = true
}) => {
  // Active question card in Google Forms focus mode
  const [activeFieldId, setActiveFieldId] = useState<string | null>(
    fields.length > 0 ? fields[0].id : null
  );

  // Keep activeFieldId focused on an existing question whenever fields change
  useEffect(() => {
    if (fields.length > 0) {
      if (!activeFieldId || !fields.some(f => f.id === activeFieldId)) {
        setActiveFieldId(fields[0].id);
      }
    } else {
      setActiveFieldId(null);
    }
  }, [fields, activeFieldId]);

  // Desktop canvas view mode: Split (side-by-side) | Focus Editor (full width) | Attendee Preview
  const [desktopViewMode, setDesktopViewMode] = useState<'split' | 'editor' | 'preview'>('split');

  // Mobile / tablet screen view toggle (Editor vs Live Preview)
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');

  // Interactive local state for live preview testing
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});

  const labelTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const fieldTypes: { 
    type: FormField['type']; 
    label: string; 
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }> 
  }[] = [
    { type: 'text', label: 'Short Answer', icon: PencilSquareIcon },
    { type: 'textarea', label: 'Paragraph', icon: DocumentTextIcon },
    { type: 'email', label: 'Email Address', icon: EnvelopeIcon },
    { type: 'phone', label: 'Phone Number', icon: PhoneIcon },
    { type: 'number', label: 'Number', icon: HashtagIcon },
    { type: 'date', label: 'Date', icon: CalendarDaysIcon },
    { type: 'select', label: 'Dropdown', icon: Bars3BottomLeftIcon },
    { type: 'radio', label: 'Multiple Choice', icon: QueueListIcon },
    { type: 'checkbox', label: 'Checkboxes', icon: CheckCircleIcon },
    { type: 'multiselect', label: 'Multi-Select', icon: ListBulletIcon },
    { type: 'rating', label: 'Rating (1-5)', icon: StarIcon },
    { type: 'file', label: 'File Upload', icon: PaperClipIcon },
    { type: 'spacer', label: 'Divider / Spacer', icon: MinusIcon }
  ];

  const addField = (fieldType: FormField['type'] = 'text') => {
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newField: FormField = {
      id: newId,
      type: fieldType,
      label: fieldType === 'spacer' ? 'Section Divider' : 'Untitled Question',
      required: false,
      gridSize: 'full',
      options: ['select', 'radio', 'checkbox', 'multiselect'].includes(fieldType)
        ? ['Option 1', 'Option 2']
        : undefined
    };

    onChange([...fields, newField]);
    setActiveFieldId(newId);
  };

  const duplicateField = (fieldId: string) => {
    const currentIndex = fields.findIndex(f => f.id === fieldId);
    if (currentIndex === -1) return;

    const original = fields[currentIndex];
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duplicate: FormField = {
      ...original,
      id: newId,
      label: `${original.label} (Copy)`,
      options: original.options ? [...original.options] : undefined,
      validation: original.validation ? { ...original.validation } : undefined
    };

    const nextFields = [...fields];
    nextFields.splice(currentIndex + 1, 0, duplicate);
    onChange(nextFields);
    setActiveFieldId(newId);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    onChange(fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const removeField = (fieldId: string) => {
    const remaining = fields.filter(field => field.id !== fieldId);
    onChange(remaining);

    if (activeFieldId === fieldId) {
      const removedIndex = fields.findIndex(f => f.id === fieldId);
      if (remaining.length === 0) {
        setActiveFieldId(null);
      } else if (removedIndex > 0) {
        setActiveFieldId(remaining[removedIndex - 1].id);
      } else {
        setActiveFieldId(remaining[0].id);
      }
    }
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(field => field.id === fieldId);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === fields.length - 1)
    ) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const nextFields = [...fields];
    [nextFields[currentIndex], nextFields[newIndex]] = [nextFields[newIndex], nextFields[currentIndex]];

    onChange(nextFields);
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
      const inputUrl = window.prompt('Enter link URL (https://...)', 'https://');
      if (!inputUrl) return;
      replacementText = `[${defaultLabel}](${inputUrl.trim()})`;
    }

    const nextLabel = `${targetField.label.slice(0, selectionStart)}${replacementText}${targetField.label.slice(selectionEnd)}`;
    updateField(fieldId, { label: nextLabel });

    const nextCursorPosition = selectionStart + replacementText.length;
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  // Render question field inside the Attendee Live Preview
  const renderPreviewInput = (field: FormField) => {
    const value = previewAnswers[field.id];

    switch (field.type) {
      case 'spacer':
        return (
          <div className="py-2">
            <div className="h-px w-full bg-outline-variant" />
          </div>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
            placeholder={field.placeholder || 'Your answer'}
            rows={3}
            className="w-full rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-base text-on-surface shadow-xs transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
          >
            <option value="">{field.placeholder || 'Choose an option'}</option>
            {field.options?.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </Select>
        );

      case 'radio':
        return (
          <div className="space-y-2.5 pt-1">
            {(field.options || ['Option 1', 'Option 2']).map((option, idx) => (
              <label 
                key={idx} 
                className="flex items-center gap-3 cursor-pointer group min-h-control"
              >
                <input
                  type="radio"
                  name={`preview_${field.id}`}
                  checked={value === option}
                  onChange={() => setPreviewAnswers(prev => ({ ...prev, [field.id]: option }))}
                  className="h-5 w-5 text-primary border-outline-variant focus:ring-primary"
                />
                <span className="text-base text-on-surface group-hover:text-primary transition-colors">
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
      case 'multiselect':
        return (
          <div className="space-y-2.5 pt-1">
            {(field.options || ['Option 1', 'Option 2']).map((option, idx) => {
              const currentList = Array.isArray(value) ? value : [];
              const isChecked = currentList.includes(option);

              return (
                <label 
                  key={idx} 
                  className="flex items-center gap-3 cursor-pointer group min-h-control"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...currentList, option]
                        : currentList.filter(item => item !== option);
                      setPreviewAnswers(prev => ({ ...prev, [field.id]: next }));
                    }}
                    className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-base text-on-surface group-hover:text-primary transition-colors">
                    {option}
                  </span>
                </label>
              );
            })}
          </div>
        );

      case 'rating':
        return (
          <div className="flex items-center gap-1.5 pt-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const currentRating = typeof value === 'number' ? value : 0;
              const isFilled = star <= currentRating;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setPreviewAnswers(prev => ({ ...prev, [field.id]: star }))}
                  className="p-1 rounded-md min-h-control flex items-center justify-center hover:scale-110 transition-transform focus:outline-hidden"
                  title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <StarIcon
                    className={`h-7 w-7 ${isFilled ? 'text-brand' : 'text-outline-variant/60'}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            {value && (
              <span className="text-sm font-medium text-on-surface-variant ml-2">
                {value} / 5
              </span>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-outline-variant rounded-xl p-5 text-center bg-surface-container-low/40 hover:bg-surface-container-low transition-colors">
            <PaperClipIcon className="h-6 w-6 text-on-surface-variant mx-auto mb-1.5" aria-hidden="true" />
            <p className="text-sm font-medium text-on-surface">Click to upload file</p>
            <p className="text-xs text-on-surface-variant mt-0.5">PDF, PNG, JPG up to 10MB</p>
          </div>
        );

      default:
        return (
          <input
            type={field.type === 'phone' ? 'tel' : field.type}
            value={value || ''}
            onChange={(e) => setPreviewAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
            placeholder={field.placeholder || (field.type === 'email' ? 'your.name@example.com' : 'Your answer')}
            className="w-full rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-base text-on-surface shadow-xs transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* View Switcher Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-1">
        {/* Mobile / Tablet Segmented Control (< 1024px) */}
        <div className="lg:hidden w-full">
          <SegmentedControl<'editor' | 'preview'>
            label="Form view selector"
            value={mobileView}
            onChange={(val) => setMobileView(val)}
            options={[
              { value: 'editor', label: `Form Editor (${fields.length})` },
              { value: 'preview', label: 'Live Attendee Preview' }
            ]}
          />
        </div>

        {/* Desktop View Mode Controls (≥ 1024px) */}
        <div className="hidden lg:flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Canvas Mode:
            </span>
            <div className="inline-flex rounded-xl border border-outline-variant bg-surface-container-low/70 p-1">
              <button
                type="button"
                onClick={() => setDesktopViewMode('split')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-control ${
                  desktopViewMode === 'split'
                    ? 'bg-white text-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <ViewColumnsIcon className="h-4 w-4" aria-hidden="true" />
                <span>Split View (Side-by-Side)</span>
              </button>
              <button
                type="button"
                onClick={() => setDesktopViewMode('editor')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-control ${
                  desktopViewMode === 'editor'
                    ? 'bg-white text-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                <span>Focus Editor (Full Width)</span>
              </button>
              <button
                type="button"
                onClick={() => setDesktopViewMode('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-control ${
                  desktopViewMode === 'preview'
                    ? 'bg-white text-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
                <span>Attendee Preview</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-on-surface-variant flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
            <span>{fields.length} {fields.length === 1 ? 'question' : 'questions'} configured</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Google Forms Style Question Editor              */}
        {/* ============================================================ */}
        <div
          className={`space-y-4 ${
            mobileView === 'preview' ? 'hidden' : 'block'
          } ${
            desktopViewMode === 'split'
              ? 'lg:block lg:col-span-7'
              : desktopViewMode === 'editor'
              ? 'lg:block lg:col-span-12 max-w-5xl mx-auto w-full'
              : 'lg:hidden'
          }`}
        >
          {/* Header Card */}
          <div className="rounded-xl border border-outline-variant bg-white shadow-xs overflow-hidden">
            <div className="h-2 bg-primary w-full" />
            <div className="p-4 sm:p-5 space-y-1.5">
              <h3 className="text-xl font-bold text-on-surface">{title}</h3>
              <p className="text-sm text-on-surface-variant">{description}</p>
              <div className="pt-1 flex items-center gap-2 text-xs font-medium text-primary">
                <InformationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Attendees fill out these questions during registration</span>
              </div>
            </div>
          </div>

          {/* Quick-Add Field Palette */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <PlusIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Add Question Field</span>
              </span>
              <span className="text-xs text-on-surface-variant">
                {fields.length} {fields.length === 1 ? 'question' : 'questions'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {fieldTypes.map((ft) => {
                const Icon = ft.icon;
                return (
                  <button
                    key={ft.type}
                    type="button"
                    onClick={() => addField(ft.type)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/80 bg-white px-3 py-2 text-xs font-medium text-on-surface hover:border-primary hover:bg-primary-container/30 hover:text-primary transition-colors min-h-control shadow-2xs"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{ft.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4">
            {fields.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-outline-variant bg-white py-12 px-6 text-center">
                <SparklesIcon className="h-10 w-10 text-primary mx-auto mb-3" aria-hidden="true" />
                <h4 className="text-base font-semibold text-on-surface mb-1">
                  No Questions Added Yet
                </h4>
                <p className="text-sm text-on-surface-variant mb-5 max-w-sm mx-auto">
                  Start building your attendee questionnaire by adding questions from the palette above.
                </p>
                <button
                  type="button"
                  onClick={() => addField('text')}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-primary-hover min-h-control"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Add First Question</span>
                </button>
              </div>
            ) : (
              fields.map((field, index) => {
                const isActive = activeFieldId === field.id;
                const fieldTypeMeta = fieldTypes.find(ft => ft.type === field.type);
                const TypeIcon = fieldTypeMeta?.icon || PencilSquareIcon;

                return (
                  <div
                    key={field.id}
                    onClick={() => {
                      if (!isActive) setActiveFieldId(field.id);
                    }}
                    className={`rounded-xl transition-colors ${
                      isActive
                        ? 'border-2 border-primary bg-white shadow-md ring-2 ring-primary/10'
                        : 'border border-outline-variant bg-white hover:border-outline shadow-xs cursor-pointer'
                    }`}
                  >
                    {/* INACTIVE CARD: Compact Google Forms summary view */}
                    {!isActive ? (
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-on-surface truncate">
                                <FormattedLabelText value={field.label || 'Untitled Question'} />
                              </span>
                              {field.required && !isSpacerField(field) && (
                                <span className="text-xs text-error font-bold" title="Required">*</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                              <TypeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>{fieldTypeMeta?.label || field.type}</span>
                              {field.gridSize === 'half' && (
                                <span>• Half width</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick card action buttons */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => moveField(field.id, 'up')}
                            disabled={index === 0}
                            className="p-2 text-outline-variant hover:text-on-surface disabled:opacity-30 min-h-control"
                            title="Move question up"
                          >
                            <ArrowUpIcon className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(field.id, 'down')}
                            disabled={index === fields.length - 1}
                            className="p-2 text-outline-variant hover:text-on-surface disabled:opacity-30 min-h-control"
                            title="Move question down"
                          >
                            <ArrowDownIcon className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="p-2 text-error hover:text-error/80 min-h-control"
                            title="Delete question"
                          >
                            <TrashIcon className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE CARD: Full Google Forms question editor */
                      <div className="p-5 sm:p-6 space-y-5">
                        {/* Card Header: Question Number, Type Selector, Move Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                              Editing Question
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveField(field.id, 'up')}
                              disabled={index === 0}
                              className="p-2 rounded-lg border border-outline-variant/70 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30 min-h-control"
                              title="Move up"
                            >
                              <ArrowUpIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveField(field.id, 'down')}
                              disabled={index === fields.length - 1}
                              className="p-2 rounded-lg border border-outline-variant/70 text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30 min-h-control"
                              title="Move down"
                            >
                              <ArrowDownIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        {/* Question Title & Prompt: Full Width */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                              Question Title / Prompt
                            </label>

                            {/* Rich Text Format Toolbar */}
                            <div className="flex items-center gap-1 bg-surface-container-low/70 p-1 rounded-lg border border-outline-variant/70">
                              <button
                                type="button"
                                onClick={() => applyLabelFormatting(field.id, 'bold')}
                                className="px-2.5 py-1 text-xs font-bold rounded hover:bg-white text-on-surface min-h-control"
                                title="Bold (**text**)"
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onClick={() => applyLabelFormatting(field.id, 'italic')}
                                className="px-2.5 py-1 text-xs italic font-serif rounded hover:bg-white text-on-surface min-h-control"
                                title="Italic (*text*)"
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onClick={() => applyLabelFormatting(field.id, 'underline')}
                                className="px-2.5 py-1 text-xs underline rounded hover:bg-white text-on-surface min-h-control"
                                title="Underline (__text__)"
                              >
                                U
                              </button>
                              <button
                                type="button"
                                onClick={() => applyLabelFormatting(field.id, 'link')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded hover:bg-white text-on-surface min-h-control"
                                title="Insert Link"
                              >
                                <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Link</span>
                              </button>
                            </div>
                          </div>

                          <textarea
                            ref={(el) => {
                              labelTextareaRefs.current[field.id] = el;
                            }}
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-base font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                            placeholder="e.g. What is your GitHub profile URL?"
                          />
                        </div>

                        {/* Question Configuration: Type Selector and Desktop Width */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                              Question Type
                            </label>
                            <Select
                              value={field.type}
                              onChange={(e) => {
                                const newType = e.target.value as FormField['type'];
                                const needsOptions = ['select', 'radio', 'checkbox', 'multiselect'].includes(newType);
                                updateField(field.id, {
                                  type: newType,
                                  options: needsOptions ? (field.options && field.options.length > 0 ? field.options : ['Option 1', 'Option 2']) : undefined
                                });
                              }}
                            >
                              {fieldTypes.map((ft) => (
                                <option key={ft.type} value={ft.type}>
                                  {ft.label}
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                              Width on Desktop Form
                            </label>
                            <Select
                              value={field.gridSize || 'full'}
                              onChange={(e) => updateField(field.id, { gridSize: e.target.value as 'full' | 'half' })}
                            >
                              <option value="full">Full Width (100%)</option>
                              <option value="half">Half Width (50%)</option>
                            </Select>
                          </div>
                        </div>

                        {/* Optional Help Text & Placeholder */}
                        {!isSpacerField(field) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            <div>
                              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                                Placeholder Text (Optional)
                              </label>
                              <input
                                type="text"
                                value={field.placeholder || ''}
                                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                                placeholder="e.g. https://github.com/username"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                                Helper / Description Note (Optional)
                              </label>
                              <input
                                type="text"
                                value={field.description || ''}
                                onChange={(e) => updateField(field.id, { description: e.target.value })}
                                className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                                placeholder="e.g. Required for coding challenge credentials"
                              />
                            </div>
                          </div>
                        )}

                        {/* Option List for Choice Types */}
                        {['select', 'radio', 'checkbox', 'multiselect'].includes(field.type) && (
                          <div className="rounded-xl border border-outline-variant/80 bg-surface-container-low/40 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                                Choices / Options
                              </label>
                              <span className="text-xs text-on-surface-variant">
                                {(field.options || []).length} options
                              </span>
                            </div>

                            <div className="space-y-2">
                              {(field.options || []).map((option, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <span className="text-on-surface-variant text-xs font-bold w-5 text-center">
                                    {field.type === 'radio' ? '○' : '□'}
                                  </span>
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const nextOptions = [...(field.options || [])];
                                      nextOptions[optIdx] = e.target.value;
                                      updateField(field.id, { options: nextOptions });
                                    }}
                                    className="flex-1 rounded-lg border border-outline-variant bg-white px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                                    placeholder={`Option ${optIdx + 1}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextOptions = (field.options || []).filter((_, i) => i !== optIdx);
                                      updateField(field.id, { options: nextOptions });
                                    }}
                                    className="p-1.5 text-error hover:bg-error-container/40 rounded-md min-h-control"
                                    title="Remove option"
                                  >
                                    <XCircleIcon className="h-5 w-5" aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center gap-3 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOptions = [...(field.options || []), `Option ${(field.options || []).length + 1}`];
                                  updateField(field.id, { options: nextOptions });
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover min-h-control"
                              >
                                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                                <span>Add Option</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const nextOptions = [...(field.options || []), 'Other (please specify)'];
                                  updateField(field.id, { options: nextOptions });
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface min-h-control"
                              >
                                <span>Add "Other"</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Validation Rules for Text / Number */}
                        {['text', 'textarea', 'number'].includes(field.type) && (
                          <details className="text-sm border border-outline-variant/60 rounded-lg p-3 bg-surface-container-low/20">
                            <summary className="font-medium text-on-surface-variant cursor-pointer select-none">
                              Validation Rules (Optional)
                            </summary>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              {field.type !== 'number' ? (
                                <>
                                  <div>
                                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                                      Min Characters
                                    </label>
                                    <input
                                      type="number"
                                      value={field.validation?.minLength || ''}
                                      onChange={(e) => updateField(field.id, {
                                        validation: {
                                          ...field.validation,
                                          minLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                                        }
                                      })}
                                      className="w-full rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-sm"
                                      placeholder="e.g. 3"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                                      Max Characters
                                    </label>
                                    <input
                                      type="number"
                                      value={field.validation?.maxLength || ''}
                                      onChange={(e) => updateField(field.id, {
                                        validation: {
                                          ...field.validation,
                                          maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined
                                        }
                                      })}
                                      className="w-full rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-sm"
                                      placeholder="e.g. 500"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                                      Min Value
                                    </label>
                                    <input
                                      type="number"
                                      value={field.validation?.min || ''}
                                      onChange={(e) => updateField(field.id, {
                                        validation: {
                                          ...field.validation,
                                          min: e.target.value ? parseFloat(e.target.value) : undefined
                                        }
                                      })}
                                      className="w-full rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                                      Max Value
                                    </label>
                                    <input
                                      type="number"
                                      value={field.validation?.max || ''}
                                      onChange={(e) => updateField(field.id, {
                                        validation: {
                                          ...field.validation,
                                          max: e.target.value ? parseFloat(e.target.value) : undefined
                                        }
                                      })}
                                      className="w-full rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-sm"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </details>
                        )}

                        {/* Active Card Footer: Duplicate, Delete, Required Switch */}
                        <div className="flex items-center justify-between border-t border-outline-variant/60 pt-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => duplicateField(field.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/80 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low min-h-control"
                              title="Duplicate question"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeField(field.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-error/30 text-xs font-medium text-error hover:bg-error-container/30 min-h-control"
                              title="Delete question"
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          </div>

                          {!isSpacerField(field) && (
                            <label className="flex items-center gap-2 cursor-pointer select-none min-h-control">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                              />
                              <span className="text-sm font-semibold text-on-surface">Required</span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================ */}
        <div
          className={`${
            mobileView === 'editor' ? 'hidden' : 'block'
          } ${
            desktopViewMode === 'split'
              ? 'lg:block lg:col-span-5'
              : desktopViewMode === 'preview'
              ? 'lg:block lg:col-span-12 max-w-2xl mx-auto w-full'
              : 'lg:hidden'
          }`}
        >
          <div className="sticky top-20 space-y-4">
            {/* Live Preview Header Badge */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Live Attendee Preview
                </span>
              </div>
              <span className="text-xs text-on-surface-variant">
                Updates in real time
              </span>
            </div>

            {/* Attendee Form Sheet Preview */}
            <div className="rounded-xl border border-outline-variant bg-white shadow-md overflow-hidden max-h-[calc(100vh-8.5rem)] overflow-y-auto">
              {/* Google Forms Top Color Strip */}
              <div className="h-2.5 bg-brand w-full" />

              <div className="p-5 sm:p-6 space-y-5">
                {/* Form Sheet Title & Intro */}
                <div className="border-b border-outline-variant/60 pb-4">
                  <h4 className="text-xl font-bold text-on-surface">
                    {title}
                  </h4>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {description}
                  </p>
                  <p className="text-xs text-error font-medium mt-3">
                    * Indicates required question
                  </p>
                </div>

                {/* Question Fields Preview */}
                <div className="space-y-5">
                  {fields.length === 0 ? (
                    <div className="py-8 text-center text-sm text-on-surface-variant">
                      No questions to preview yet. Add questions on the left.
                    </div>
                  ) : (
                    fields.map((field) => {
                      return (
                        <div
                          key={field.id}
                          className={`space-y-1.5 ${
                            activeFieldId === field.id
                              ? 'rounded-lg bg-primary-container/20 p-2.5 -mx-2.5 transition-colors'
                              : ''
                          }`}
                        >
                          {!isSpacerField(field) && (
                            <label className="block text-sm font-semibold text-on-surface">
                              <FormattedLabelText value={field.label} />
                              {field.required && <span className="text-error ml-1">*</span>}
                            </label>
                          )}
                          
                          {field.description && (
                            <p className="text-xs text-on-surface-variant">
                              {field.description}
                            </p>
                          )}

                          {renderPreviewInput(field)}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Simulated Submit Button */}
                <div className="pt-4 border-t border-outline-variant/60 flex items-center justify-between">
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-primary/70 px-5 py-2.5 text-sm font-medium text-white cursor-not-allowed min-h-control"
                  >
                    Submit Registration
                  </button>
                  <span className="text-xs text-on-surface-variant/70 italic">
                    Attendee view
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormBuilder;
