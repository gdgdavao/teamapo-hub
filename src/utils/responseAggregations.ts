/**
 * Pure aggregation and grouping helpers for the Event Workspace Responses tab.
 *
 * Layering rule (AGENTS.md §4.3): zero side effects and zero Firebase imports.
 * Handles dynamic `event.registrationForm: FormField[]`, `customResponses` /
 * `customFormData` / `formSubmission` maps, standard `userDetails` fallbacks,
 * legacy positional keys ('1' name, '2' email, '3' phone), and orphaned keys.
 */

import { FormField } from '../types';

export interface RegistrationLike {
  id: string;
  attendanceStatus?: string;
  status?: string;
  paymentStatus?: string;
  ticketTypeId?: string;
  registrationDate?: unknown;
  userDetails?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
    organization?: string;
  };
  attendee?: {
    name?: string;
    email?: string;
    phone?: string;
    organization?: string;
  };
  customResponses?: Record<string, unknown>;
  customFormData?: Record<string, unknown>;
  formSubmission?: Record<string, unknown>;
}

export interface OptionCount {
  option: string;
  count: number;
  percentage: number;
}

export interface RatingBucket {
  rating: number;
  count: number;
  percentage: number;
}

export interface NumberSummaryStats {
  min: number;
  max: number;
  average: number;
  buckets: OptionCount[];
}

export interface TextAnswerEntry {
  value: string;
  count: number;
}

export interface QuestionSummary {
  field: FormField;
  label: string;
  respondentCount: number;
  answeredCount: number;
  completionPct: number;
  kind: 'choice' | 'rating' | 'number' | 'date' | 'text';
  options?: OptionCount[];
  ratingDistribution?: RatingBucket[];
  ratingAverage?: number;
  numberStats?: NumberSummaryStats;
  textAnswers?: TextAnswerEntry[];
}

export interface OrphanEntry {
  key: string;
  label: string;
  value: string;
}

export interface OrphanResponseItem {
  registrationId: string;
  attendeeName: string;
  attendeeEmail: string;
  entries: OrphanEntry[];
}

export interface GroupBreakdown {
  groupValue: string;
  count: number;
  percentage: number;
  summaries: QuestionSummary[];
}

/** Strip markdown-like emphasis markers from FormField labels. */
export function cleanQuestionLabel(label: string): string {
  return String(label || '')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .trim();
}

/** Exclude cancelled registrations so response counts match activeRegistrations. */
export function isActiveRespondent(reg: RegistrationLike): boolean {
  const attendance = String(reg.attendanceStatus ?? '').toLowerCase();
  const status = String(reg.status ?? '').toLowerCase();
  return attendance !== 'cancelled' && status !== 'cancelled';
}

export function getRawResponseMap(reg: RegistrationLike): Record<string, unknown> {
  const map = reg.customResponses ?? reg.customFormData ?? reg.formSubmission;
  return map && typeof map === 'object' ? (map as Record<string, unknown>) : {};
}

export function getRespondentName(reg: RegistrationLike): string {
  const direct = (reg.userDetails?.name || reg.attendee?.name || '').trim();
  if (direct && direct !== 'Anonymous Attendee') return direct;
  const raw = getRawResponseMap(reg);
  const first = raw['1'] ?? raw['first_name'] ?? raw['firstName'] ?? raw['name'] ?? raw['fullName'];
  const last = raw['1762143123275'] ?? raw['last_name'] ?? raw['lastName'];
  const combined = `${first ?? ''} ${last ?? ''}`.trim();
  return combined || direct || 'Anonymous Attendee';
}

export function getRespondentEmail(reg: RegistrationLike): string {
  const direct = (reg.userDetails?.email || reg.attendee?.email || '').trim();
  if (direct) return direct;
  const raw = getRawResponseMap(reg);
  const fallback = raw['2'] ?? raw['email'];
  return typeof fallback === 'string' ? fallback.trim() : '';
}

/**
 * Resolves a registration's answer for a given FormField, checking:
 * 1. Exact `field.id` or `field.id.toLowerCase()` in the response map
 * 2. Legacy positional keys ('1' name, '2' email, '3' phone) & `userDetails` fallbacks
 */
export function resolveFieldAnswer(reg: RegistrationLike, field: FormField): unknown {
  const raw = getRawResponseMap(reg);
  const direct = raw[field.id] ?? raw[field.id.toLowerCase()];
  if (direct !== undefined && direct !== null && direct !== '') {
    if (!Array.isArray(direct) || direct.length > 0) {
      return direct;
    }
  }

  const labelLower = cleanQuestionLabel(field.label).toLowerCase();
  const idLower = field.id.toLowerCase();
  const isOrgKeyword =
    idLower.includes('organization') ||
    idLower.includes('company') ||
    idLower.includes('school') ||
    idLower.includes('university') ||
    labelLower.includes('organization') ||
    labelLower.includes('company') ||
    labelLower.includes('school') ||
    labelLower.includes('university');

  if (field.type === 'email' || idLower === '2' || idLower.includes('email') || labelLower.includes('email')) {
    return raw['2'] ?? reg.userDetails?.email ?? reg.attendee?.email ?? undefined;
  }

  if (!isOrgKeyword && (idLower === '1' || idLower.includes('name') || labelLower.includes('name'))) {
    return raw['1'] ?? reg.userDetails?.name ?? reg.attendee?.name ?? undefined;
  }

  if (
    field.type === 'phone' ||
    idLower === '3' ||
    idLower.includes('phone') ||
    idLower.includes('mobile') ||
    labelLower.includes('phone') ||
    labelLower.includes('mobile') ||
    ((idLower.includes('contact') || labelLower.includes('contact')) &&
      !idLower.includes('emergency') &&
      !labelLower.includes('emergency'))
  ) {
    return raw['3'] ?? reg.userDetails?.phoneNumber ?? reg.attendee?.phone ?? undefined;
  }

  if (isOrgKeyword) {
    return reg.userDetails?.organization ?? reg.attendee?.organization ?? undefined;
  }

  return undefined;
}

export function isAnswerNonEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.some((item) => String(item ?? '').trim().length > 0);
  if (typeof val === 'number') return Number.isFinite(val);
  if (typeof val === 'boolean') return true;
  if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0;
  return false;
}

/** Normalize an answer into one or more string tokens (splitting multiselects). */
export function normalizeChoiceTokens(val: unknown, fieldType: FormField['type']): string[] {
  if (!isAnswerNonEmpty(val)) return [];
  if (Array.isArray(val)) {
    return val.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof val === 'boolean') {
    return [val ? 'Yes' : 'No'];
  }
  const str = String(val).trim();
  if (!str) return [];
  if (fieldType === 'multiselect' && str.includes(',')) {
    return str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [str];
}

export function formatAnswerDisplay(val: unknown): string {
  if (!isAnswerNonEmpty(val)) return 'Not provided';
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean).join(', ');
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    if (obj.name && obj.phone) return `${String(obj.name)} (${String(obj.phone)})`;
    return JSON.stringify(val);
  }
  return String(val).trim();
}

/**
 * Summarize all active registrations' answers for a single FormField.
 */
export function summarizeQuestion(
  registrations: RegistrationLike[],
  field: FormField
): QuestionSummary {
  const activeRegs = registrations.filter(isActiveRespondent);
  const respondentCount = activeRegs.length;
  const label = cleanQuestionLabel(field.label);

  const rawAnswers: unknown[] = [];
  for (const reg of activeRegs) {
    const ans = resolveFieldAnswer(reg, field);
    if (isAnswerNonEmpty(ans)) {
      rawAnswers.push(ans);
    }
  }

  const answeredCount = rawAnswers.length;
  const completionPct = respondentCount > 0 ? Math.round((answeredCount / respondentCount) * 100) : 0;

  if (
    field.type === 'select' ||
    field.type === 'radio' ||
    field.type === 'multiselect' ||
    (field.type === 'checkbox' && Array.isArray(field.options) && field.options.length > 0)
  ) {
    const counts = new Map<string, number>();
    for (const opt of field.options ?? []) {
      const trimmed = opt.trim();
      if (trimmed) counts.set(trimmed, 0);
    }

    for (const ans of rawAnswers) {
      const tokens = normalizeChoiceTokens(ans, field.type);
      for (const token of tokens) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    const denom = Math.max(1, answeredCount);
    const options: OptionCount[] = Array.from(counts.entries()).map(([option, count]) => ({
      option,
      count,
      percentage: answeredCount > 0 ? Math.round((count / denom) * 100) : 0,
    }));

    return {
      field,
      label,
      respondentCount,
      answeredCount,
      completionPct,
      kind: 'choice',
      options,
    };
  }

  if (field.type === 'checkbox') {
    let yesCount = 0;
    let noCount = 0;
    for (const ans of rawAnswers) {
      if (ans === true || String(ans).toLowerCase() === 'true' || String(ans).toLowerCase() === 'yes') {
        yesCount += 1;
      } else {
        noCount += 1;
      }
    }
    const denom = Math.max(1, answeredCount);
    return {
      field,
      label,
      respondentCount,
      answeredCount,
      completionPct,
      kind: 'choice',
      options: [
        { option: 'Yes', count: yesCount, percentage: answeredCount > 0 ? Math.round((yesCount / denom) * 100) : 0 },
        { option: 'No', count: noCount, percentage: answeredCount > 0 ? Math.round((noCount / denom) * 100) : 0 },
      ],
    };
  }

  if (field.type === 'rating') {
    const distMap = new Map<number, number>([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
    let sum = 0;
    let validCount = 0;

    for (const ans of rawAnswers) {
      const n = Number(ans);
      if (Number.isFinite(n) && n >= 1 && n <= 5) {
        const rounded = Math.round(n);
        distMap.set(rounded, (distMap.get(rounded) ?? 0) + 1);
        sum += n;
        validCount += 1;
      }
    }

    const denom = Math.max(1, validCount);
    const ratingDistribution: RatingBucket[] = [5, 4, 3, 2, 1].map((rating) => {
      const count = distMap.get(rating) ?? 0;
      return {
        rating,
        count,
        percentage: validCount > 0 ? Math.round((count / denom) * 100) : 0,
      };
    });

    return {
      field,
      label,
      respondentCount,
      answeredCount: validCount,
      completionPct: respondentCount > 0 ? Math.round((validCount / respondentCount) * 100) : 0,
      kind: 'rating',
      ratingDistribution,
      ratingAverage: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : 0,
    };
  }

  if (field.type === 'number') {
    const nums: number[] = [];
    const freq = new Map<string, number>();

    for (const ans of rawAnswers) {
      const n = Number(ans);
      if (Number.isFinite(n)) {
        nums.push(n);
        const key = String(n);
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
    }

    const validCount = nums.length;
    const min = validCount > 0 ? Math.min(...nums) : 0;
    const max = validCount > 0 ? Math.max(...nums) : 0;
    const avg = validCount > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / validCount) * 100) / 100 : 0;
    const denom = Math.max(1, validCount);

    const buckets: OptionCount[] = Array.from(freq.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([option, count]) => ({
        option,
        count,
        percentage: validCount > 0 ? Math.round((count / denom) * 100) : 0,
      }));

    return {
      field,
      label,
      respondentCount,
      answeredCount: validCount,
      completionPct: respondentCount > 0 ? Math.round((validCount / respondentCount) * 100) : 0,
      kind: 'number',
      numberStats: {
        min,
        max,
        average: avg,
        buckets,
      },
    };
  }

  // Default: text, email, phone, textarea, date, file
  const tally = new Map<string, number>();
  for (const ans of rawAnswers) {
    const formatted = formatAnswerDisplay(ans);
    if (formatted && formatted !== 'Not provided') {
      tally.set(formatted, (tally.get(formatted) ?? 0) + 1);
    }
  }

  const entries: TextAnswerEntry[] = Array.from(tally.entries()).map(([value, count]) => ({
    value,
    count,
  }));

  if (field.type === 'date') {
    entries.sort((a, b) => a.value.localeCompare(b.value));
  } else {
    entries.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }

  return {
    field,
    label,
    respondentCount,
    answeredCount,
    completionPct,
    kind: field.type === 'date' ? 'date' : 'text',
    textAnswers: entries,
  };
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

/**
 * Collect responses whose keys are not present in the current `formFields` definition.
 */
export function collectOrphanResponses(
  registrations: RegistrationLike[],
  formFields: FormField[]
): OrphanResponseItem[] {
  const activeRegs = registrations.filter(isActiveRespondent);
  const knownKeys = new Set<string>();
  for (const f of formFields) {
    knownKeys.add(f.id);
    knownKeys.add(f.id.toLowerCase());
  }

  // Legacy positional keys ('1' name, '2' email, '3' phone) are mapped when matching fields exist
  const hasNameField = formFields.some(
    (f) => f.id === '1' || f.id.toLowerCase().includes('name') || f.label.toLowerCase().includes('name')
  );
  const hasEmailField = formFields.some(
    (f) => f.type === 'email' || f.id === '2' || f.id.toLowerCase().includes('email') || f.label.toLowerCase().includes('email')
  );
  const hasPhoneField = formFields.some(
    (f) =>
      f.type === 'phone' ||
      f.id === '3' ||
      f.id.toLowerCase().includes('phone') ||
      f.label.toLowerCase().includes('phone') ||
      f.label.toLowerCase().includes('mobile')
  );

  if (hasNameField) knownKeys.add('1');
  if (hasEmailField) knownKeys.add('2');
  if (hasPhoneField) knownKeys.add('3');

  const items: OrphanResponseItem[] = [];

  for (const reg of activeRegs) {
    const raw = getRawResponseMap(reg);
    const entries: OrphanEntry[] = [];

    for (const [key, val] of Object.entries(raw)) {
      if (knownKeys.has(key) || knownKeys.has(key.toLowerCase())) continue;
      if (!isAnswerNonEmpty(val)) continue;
      entries.push({
        key,
        label: humanizeKey(key),
        value: formatAnswerDisplay(val),
      });
    }

    if (entries.length > 0) {
      items.push({
        registrationId: reg.id,
        attendeeName: getRespondentName(reg),
        attendeeEmail: getRespondentEmail(reg),
        entries,
      });
    }
  }

  return items;
}

/**
 * Group active registrations by their response to `groupField`, and compute
 * per-question summaries inside each group.
 */
export function groupResponses(
  registrations: RegistrationLike[],
  groupField: FormField,
  allFields: FormField[]
): GroupBreakdown[] {
  const activeRegs = registrations.filter(isActiveRespondent);
  const totalActive = activeRegs.length;
  const targetFields = allFields.filter((f) => f.type !== 'spacer' && f.id !== groupField.id);

  const buckets = new Map<string, RegistrationLike[]>();

  for (const reg of activeRegs) {
    const ans = resolveFieldAnswer(reg, groupField);
    const tokens = normalizeChoiceTokens(ans, groupField.type);
    if (tokens.length === 0) {
      const unanswered = buckets.get('Unanswered') ?? [];
      unanswered.push(reg);
      buckets.set('Unanswered', unanswered);
    } else {
      for (const token of tokens) {
        const list = buckets.get(token) ?? [];
        list.push(reg);
        buckets.set(token, list);
      }
    }
  }

  const breakdowns: GroupBreakdown[] = Array.from(buckets.entries())
    .sort((a, b) => {
      if (a[0] === 'Unanswered') return 1;
      if (b[0] === 'Unanswered') return -1;
      return b[1].length - a[1].length || a[0].localeCompare(b[0]);
    })
    .map(([groupValue, groupRegs]) => ({
      groupValue,
      count: groupRegs.length,
      percentage: totalActive > 0 ? Math.round((groupRegs.length / totalActive) * 100) : 0,
      summaries: targetFields.map((f) => summarizeQuestion(groupRegs, f)),
    }));

  return breakdowns;
}
