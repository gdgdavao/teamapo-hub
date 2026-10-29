import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UsersIcon,
  Squares2X2Icon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/20/solid';
import toast from 'react-hot-toast';
import {
  Badge,
  Card,
  EmptyState,
  Input,
  LoadingSpinner,
  ProgressBar,
  SegmentedControl,
  Select,
  type BadgeTone,
  type SegmentedControlOption,
} from '../../../../components/UI';
import { EventService } from '../../../../services/eventService';
import { RegistrationService } from '../../../../services/registrationService';
import { Event, FormField, Registration } from '../../../../types';
import { logger } from '../../../../utils/logger';
import { formatDate } from '../../../../utils/dateUtils';
import {
  QuestionSummary,
  cleanQuestionLabel,
  collectOrphanResponses,
  formatAnswerDisplay,
  getRespondentEmail,
  getRespondentName,
  groupResponses,
  isActiveRespondent,
  isAnswerNonEmpty,
  resolveFieldAnswer,
  summarizeQuestion,
} from '../../../../utils/responseAggregations';

export interface ResponsesTabProps {
  /** Required. The tab renders inside /events/:eventId; see AttendeesTab. */
  eventId: string;
}

type ResponsesViewMode = 'questions' | 'group' | 'individual';

const VIEW_OPTIONS: ReadonlyArray<SegmentedControlOption<ResponsesViewMode>> = [
  { value: 'questions', label: 'Questions' },
  { value: 'group', label: 'Group' },
  { value: 'individual', label: 'Individual' },
];

const FALLBACK_DEFAULT_FIELDS: FormField[] = [
  { id: 'name', type: 'text', label: 'Full Name', required: true, gridSize: 'half' },
  { id: 'email', type: 'email', label: 'Email Address', required: true, gridSize: 'half' },
  { id: 'phone', type: 'phone', label: 'Phone Number', required: false, gridSize: 'half' },
  { id: 'organization', type: 'text', label: 'Organization / School', required: false, gridSize: 'half' },
];

function getStatusBadgeTone(attendanceStatus?: string): BadgeTone {
  switch (attendanceStatus) {
    case 'checked-in':
      return 'success';
    case 'confirmed':
      return 'info';
    case 'no-show':
    case 'cancelled':
      return 'danger';
    default:
      return 'warning';
  }
}

function formatAttendanceStatus(attendanceStatus?: string): string {
  switch (attendanceStatus) {
    case 'checked-in':
      return 'Checked In';
    case 'confirmed':
      return 'Confirmed';
    case 'no-show':
      return 'No Show';
    case 'cancelled':
      return 'Cancelled';
    case 'registered':
    default:
      return 'Registered';
  }
}

const QuestionSummaryCard: React.FC<{
  summary: QuestionSummary;
  compact?: boolean;
}> = ({ summary, compact = false }) => {
  const { field, label, respondentCount, answeredCount, completionPct, kind } = summary;

  return (
    <Card
      aria-label={`Question summary: ${label}`}
      padding={compact ? 'md' : 'lg'}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-outline-variant pb-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-on-surface break-words`}>
              {label}
            </h3>
            {field.required && (
              <span className="text-xs font-semibold text-error" title="Required field">
                *
              </span>
            )}
            <Badge tone="neutral">{field.type}</Badge>
          </div>
          {field.description && !compact && (
            <p className="text-xs text-on-surface-variant">{field.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-medium text-on-surface-variant">
          <span className="rounded-full bg-surface-container-low px-2.5 py-1 border border-outline-variant text-on-surface">
            {answeredCount} / {respondentCount} responses ({completionPct}% complete)
          </span>
        </div>
      </div>

      {answeredCount === 0 ? (
        <p className="text-sm text-on-surface-variant py-2">No responses recorded for this question yet.</p>
      ) : kind === 'choice' && summary.options ? (
        <div className="space-y-3">
          {summary.options.map((opt) => (
            <div key={opt.option} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-on-surface break-words min-w-0">{opt.option}</span>
                <span className="text-xs font-semibold text-on-surface-variant tabular-nums shrink-0">
                  {opt.count} ({opt.percentage}%)
                </span>
              </div>
              <ProgressBar
                value={opt.percentage}
                size="sm"
                color="bg-primary"
                label={`${opt.option}: ${opt.count} responses (${opt.percentage}%)`}
              />
            </div>
          ))}
        </div>
      ) : kind === 'rating' && summary.ratingDistribution ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-3 border border-outline-variant">
            <div className="flex items-center gap-1 text-2xl font-bold text-on-surface tabular-nums">
              <span>{summary.ratingAverage?.toFixed(1) ?? '0.0'}</span>
              <StarIcon className="h-6 w-6 text-warning" aria-hidden="true" />
            </div>
            <span className="text-xs text-on-surface-variant">
              Average rating across {answeredCount} {answeredCount === 1 ? 'response' : 'responses'}
            </span>
          </div>
          <div className="space-y-2">
            {summary.ratingDistribution.map((bucket) => (
              <div key={bucket.rating} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
                  <span>{bucket.rating} {bucket.rating === 1 ? 'star' : 'stars'}</span>
                  <span className="tabular-nums">{bucket.count} ({bucket.percentage}%)</span>
                </div>
                <ProgressBar
                  value={bucket.percentage}
                  size="sm"
                  color="bg-primary"
                  label={`${bucket.rating} stars: ${bucket.count} responses`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : kind === 'number' && summary.numberStats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface-container-low p-3 border border-outline-variant">
              <span className="block text-xs text-on-surface-variant">Min</span>
              <span className="text-lg font-bold text-on-surface tabular-nums">{summary.numberStats.min}</span>
            </div>
            <div className="rounded-lg bg-surface-container-low p-3 border border-outline-variant">
              <span className="block text-xs text-on-surface-variant">Average</span>
              <span className="text-lg font-bold text-on-surface tabular-nums">{summary.numberStats.average}</span>
            </div>
            <div className="rounded-lg bg-surface-container-low p-3 border border-outline-variant">
              <span className="block text-xs text-on-surface-variant">Max</span>
              <span className="text-lg font-bold text-on-surface tabular-nums">{summary.numberStats.max}</span>
            </div>
          </div>
          {summary.numberStats.buckets.length > 0 && (
            <div className="space-y-2">
              {summary.numberStats.buckets.slice(0, 8).map((b) => (
                <div key={b.option} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-on-surface">
                    <span>{b.option}</span>
                    <span className="text-on-surface-variant tabular-nums">{b.count} ({b.percentage}%)</span>
                  </div>
                  <ProgressBar
                    value={b.percentage}
                    size="sm"
                    color="bg-primary"
                    label={`${b.option}: ${b.count} responses`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {(summary.textAnswers ?? []).map((entry) => (
            <div
              key={entry.value}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-sm border border-outline-variant/60"
            >
              <span className="text-on-surface break-words">{entry.value}</span>
              {entry.count > 1 && (
                <Badge tone="info">{entry.count}×</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const ResponsesTab: React.FC<ResponsesTabProps> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ResponsesViewMode>('questions');
  const [selectedGroupFieldId, setSelectedGroupFieldId] = useState<string>('');
  const [individualSearch, setIndividualSearch] = useState<string>('');
  const [expandedRegistrantIds, setExpandedRegistrantIds] = useState<Set<string>>(() => new Set());
  const [orphansExpanded, setOrphansExpanded] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const loadResponsesData = async () => {
      try {
        setLoading(true);
        const [eventData, regsData, subcollectionForm] = await Promise.all([
          EventService.getEvent(eventId),
          RegistrationService.getEventRegistrations(eventId),
          EventService.getEventRegistrationForm(eventId).catch(() => [] as FormField[]),
        ]);

        if (!isMounted) return;

        setEvent(eventData);
        setRegistrations(regsData);

        const resolvedFields =
          subcollectionForm.length > 0
            ? subcollectionForm
            : eventData?.registrationForm && eventData.registrationForm.length > 0
            ? eventData.registrationForm
            : FALLBACK_DEFAULT_FIELDS;

        setFormFields(resolvedFields);

        const nonSpacer = resolvedFields.filter((f) => f.type !== 'spacer');
        const preferredGroupField =
          nonSpacer.find((f) =>
            ['select', 'radio', 'multiselect', 'checkbox'].includes(f.type)
          ) ?? nonSpacer[0];
        if (preferredGroupField) {
          setSelectedGroupFieldId(preferredGroupField.id);
        }
      } catch (err) {
        logger.error('[ResponsesTab] Failed to load responses:', err);
        toast.error('Failed to load form responses. Please refresh and try again.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadResponsesData();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const activeRegistrations = useMemo(
    () => registrations.filter(isActiveRespondent),
    [registrations]
  );

  const questionFields = useMemo(
    () => formFields.filter((f) => f.type !== 'spacer'),
    [formFields]
  );

  const questionSummaries = useMemo(
    () => questionFields.map((field) => summarizeQuestion(activeRegistrations, field)),
    [activeRegistrations, questionFields]
  );

  const orphanResponses = useMemo(
    () => collectOrphanResponses(activeRegistrations, questionFields),
    [activeRegistrations, questionFields]
  );

  const groupFieldOptions = useMemo(() => {
    const choiceFirst = [...questionFields].sort((a, b) => {
      const aChoice = ['select', 'radio', 'multiselect', 'checkbox'].includes(a.type) ? 0 : 1;
      const bChoice = ['select', 'radio', 'multiselect', 'checkbox'].includes(b.type) ? 0 : 1;
      return aChoice - bChoice;
    });
    return choiceFirst.map((f) => ({
      value: f.id,
      label: `${cleanQuestionLabel(f.label)} (${f.type})`,
    }));
  }, [questionFields]);

  const activeGroupField = useMemo(
    () => questionFields.find((f) => f.id === selectedGroupFieldId) ?? questionFields[0] ?? null,
    [questionFields, selectedGroupFieldId]
  );

  const groupBreakdowns = useMemo(() => {
    if (!activeGroupField) return [];
    return groupResponses(activeRegistrations, activeGroupField, questionFields);
  }, [activeRegistrations, activeGroupField, questionFields]);

  const filteredIndividuals = useMemo(() => {
    const q = individualSearch.trim().toLowerCase();
    if (!q) return activeRegistrations;
    return activeRegistrations.filter((reg) => {
      const name = getRespondentName(reg).toLowerCase();
      const email = getRespondentEmail(reg).toLowerCase();
      if (name.includes(q) || email.includes(q)) return true;
      return questionFields.some((field) => {
        const val = formatAnswerDisplay(resolveFieldAnswer(reg, field)).toLowerCase();
        return val.includes(q);
      });
    });
  }, [activeRegistrations, individualSearch, questionFields]);

  const toggleRegistrantExpanded = (regId: string) => {
    setExpandedRegistrantIds((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  };

  const getTicketName = (reg: Registration): string => {
    const matched = event?.ticketTypes?.find((t) => t.id === reg.ticketTypeId);
    if (matched?.name) return matched.name;
    if (reg.pricing && typeof (reg.pricing as any).ticketTypeName === 'string') {
      return (reg.pricing as any).ticketTypeName;
    }
    return reg.ticketTypeId || 'General Admission';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (activeRegistrations.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardDocumentListIcon className="h-12 w-12 text-outline-variant" />}
        title="No responses yet"
        description="Form responses from registered attendees will appear here automatically as registrations come in."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & View Switcher */}
      <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold text-on-surface">Registration Form Responses</h2>
            <Badge tone="info">
              {activeRegistrations.length} {activeRegistrations.length === 1 ? 'respondent' : 'respondents'}
            </Badge>
            <Badge tone="neutral">
              {questionFields.length} {questionFields.length === 1 ? 'question' : 'questions'}
            </Badge>
          </div>
          <p className="text-sm text-on-surface-variant">
            Analyze form answers by question, group respondents by any field, or inspect individual submissions.
          </p>
        </div>

        <SegmentedControl<ResponsesViewMode>
          label="Responses view mode"
          options={VIEW_OPTIONS}
          value={viewMode}
          onChange={setViewMode}
        />
      </div>

      {/* 1. Questions Sub-View */}
      {viewMode === 'questions' && (
        <div className="space-y-6" role="region" aria-label="Responses by question">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {questionSummaries.map((summary) => (
              <QuestionSummaryCard key={summary.field.id} summary={summary} />
            ))}
          </div>

          {/* Orphaned / Legacy Responses Accordion */}
          {orphanResponses.length > 0 && (
            <Card aria-label="Orphaned responses" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-on-surface">
                    Orphaned Responses ({orphanResponses.length})
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Answers submitted for fields that were later removed or renamed in the form builder.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOrphansExpanded((prev) => !prev)}
                  aria-expanded={orphansExpanded}
                  className="inline-flex min-h-control items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>{orphansExpanded ? 'Hide' : 'Show'}</span>
                  {orphansExpanded ? (
                    <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              {orphansExpanded && (
                <div className="divide-y divide-outline-variant border-t border-outline-variant pt-3 space-y-3">
                  {orphanResponses.map((item) => (
                    <div key={item.registrationId} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-on-surface">{item.attendeeName}</span>
                        {item.attendeeEmail && (
                          <span className="text-xs text-on-surface-variant">{item.attendeeEmail}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.entries.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-lg bg-surface-container-low p-2.5 border border-outline-variant/60 text-xs"
                          >
                            <span className="font-medium text-on-surface-variant block">{entry.label}</span>
                            <span className="font-semibold text-on-surface break-words mt-0.5 block">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* 2. Group Sub-View */}
      {viewMode === 'group' && (
        <div className="space-y-6" role="region" aria-label="Grouped responses">
          <Card className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="w-full sm:max-w-md">
              <Select
                label="Group responses by question"
                value={activeGroupField?.id ?? ''}
                onChange={(e) => setSelectedGroupFieldId(e.target.value)}
                options={groupFieldOptions}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <Squares2X2Icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>
                {groupBreakdowns.length} {groupBreakdowns.length === 1 ? 'group' : 'groups'} found
              </span>
            </div>
          </Card>

          {groupBreakdowns.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-10 w-10 text-outline-variant" />}
              title="No groups available"
              description="Select a question above to segment responses."
            />
          ) : (
            <div className="space-y-6">
              {groupBreakdowns.map((group) => (
                <Card
                  key={group.groupValue}
                  aria-label={`Group: ${group.groupValue}`}
                  className="space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-on-surface">{group.groupValue}</h3>
                      <Badge tone={group.groupValue === 'Unanswered' ? 'neutral' : 'info'}>
                        {group.count} {group.count === 1 ? 'respondent' : 'respondents'} ({group.percentage}%)
                      </Badge>
                    </div>
                  </div>

                  {group.summaries.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {group.summaries.map((s) => (
                        <QuestionSummaryCard key={`${group.groupValue}-${s.field.id}`} summary={s} compact />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      No additional questions to summarize inside this group.
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Individual Sub-View */}
      {viewMode === 'individual' && (
        <div className="space-y-6" role="region" aria-label="Individual respondent submissions">
          <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full sm:max-w-md">
              <Input
                label="Search respondents"
                placeholder="Search by name, email, or response..."
                value={individualSearch}
                onChange={(e) => setIndividualSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <UserIcon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>
                Showing {filteredIndividuals.length} of {activeRegistrations.length} respondents
              </span>
            </div>
          </Card>

          {filteredIndividuals.length === 0 ? (
            <EmptyState
              icon={<UserIcon className="h-10 w-10 text-outline-variant" />}
              title="No matching respondents"
              description="Try clearing or adjusting your search query."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredIndividuals.map((reg) => {
                const isExpanded = expandedRegistrantIds.has(reg.id);
                const respondentName = getRespondentName(reg);
                const respondentEmail = getRespondentEmail(reg);
                const orphanForReg = orphanResponses.find((o) => o.registrationId === reg.id);

                return (
                  <Card
                    key={reg.id}
                    aria-label={`Respondent ${respondentName}`}
                    padding="none"
                    className="overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleRegistrantExpanded(reg.id)}
                      aria-expanded={isExpanded}
                      className="w-full min-h-control flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-on-surface truncate">
                            {respondentName}
                          </span>
                          <Badge tone={getStatusBadgeTone(reg.attendanceStatus)}>
                            {formatAttendanceStatus(reg.attendanceStatus)}
                          </Badge>
                          <Badge tone="neutral">{getTicketName(reg)}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                          {respondentEmail && <span>{respondentEmail}</span>}
                          {reg.registrationDate && (
                            <span>Submitted {formatDate(reg.registrationDate)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-primary shrink-0">
                        <span>{isExpanded ? 'Hide answers' : 'View answers'}</span>
                        {isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-outline-variant bg-surface-container-low/50 p-4 sm:p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {questionFields.map((field) => {
                            const val = resolveFieldAnswer(reg, field);
                            const answered = isAnswerNonEmpty(val);
                            return (
                              <div
                                key={field.id}
                                className={`rounded-lg bg-white p-3 border border-outline-variant ${
                                  field.gridSize === 'full' || field.type === 'textarea'
                                    ? 'sm:col-span-2'
                                    : 'sm:col-span-1'
                                }`}
                              >
                                <span className="text-xs font-medium text-on-surface-variant block">
                                  {cleanQuestionLabel(field.label)}
                                </span>
                                <span
                                  className={`mt-1 block text-sm break-words whitespace-pre-wrap ${
                                    answered
                                      ? 'font-semibold text-on-surface'
                                      : 'italic text-on-surface-variant/70'
                                  }`}
                                >
                                  {formatAnswerDisplay(val)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {orphanForReg && orphanForReg.entries.length > 0 && (
                          <div className="pt-3 border-t border-outline-variant space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block">
                              Orphaned / Legacy Fields
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {orphanForReg.entries.map((entry) => (
                                <div
                                  key={entry.key}
                                  className="rounded-lg bg-white p-3 border border-outline-variant"
                                >
                                  <span className="text-xs font-medium text-on-surface-variant block">
                                    {entry.label}
                                  </span>
                                  <span className="mt-1 block text-sm font-semibold text-on-surface break-words">
                                    {entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResponsesTab;
