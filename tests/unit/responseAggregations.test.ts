import { describe, it, expect } from 'vitest';
import {
  summarizeQuestion,
  collectOrphanResponses,
  groupResponses,
  RegistrationLike,
} from '../../src/utils/responseAggregations';
import { FormField } from '../../src/types';

const SAMPLE_FIELDS: FormField[] = [
  { id: '1', type: 'text', label: 'Full Name', required: true },
  { id: '2', type: 'email', label: 'Email Address', required: true },
  {
    id: 'role',
    type: 'select',
    label: 'Developer Role',
    required: true,
    options: ['Frontend', 'Backend', 'Fullstack', 'Student'],
  },
  {
    id: 'topics',
    type: 'multiselect',
    label: 'Interests',
    required: false,
    options: ['AI', 'Web', 'Cloud'],
  },
  { id: 'exp', type: 'number', label: 'Years of Experience', required: false },
  { id: 'excited', type: 'rating', label: 'Excitement Level', required: false },
  { id: 'newsletter', type: 'checkbox', label: 'Subscribe to newsletter', required: false },
  { id: 'arrival', type: 'date', label: 'Arrival Date', required: false },
];

const SAMPLE_REGISTRATIONS: RegistrationLike[] = [
  {
    id: 'reg-1',
    attendanceStatus: 'registered',
    userDetails: { name: 'Ada Lovelace', email: 'ada@gdgdavao.org' },
    customResponses: {
      role: 'Backend',
      topics: ['AI', 'Cloud'],
      exp: 5,
      excited: 5,
      newsletter: true,
      arrival: '2026-11-20',
      legacyShirtSize: 'M',
    },
  },
  {
    id: 'reg-2',
    attendanceStatus: 'checked-in',
    customFormData: {
      '1': 'Grace Hopper',
      '2': 'grace@gdgdavao.org',
      role: 'Backend',
      topics: 'AI, Web',
      exp: 10,
      excited: 4,
      newsletter: false,
      arrival: '2026-11-19',
    },
  },
  {
    id: 'reg-3',
    attendanceStatus: 'no-show',
    userDetails: { name: 'Alan Turing', email: 'alan@gdgdavao.org' },
    formSubmission: {
      role: 'Student',
      topics: ['AI'],
      exp: 0,
      excited: 5,
    },
  },
  {
    id: 'reg-cancelled',
    attendanceStatus: 'cancelled',
    userDetails: { name: 'Cancelled User', email: 'cancel@gdgdavao.org' },
    customResponses: {
      role: 'Frontend',
      topics: ['Web'],
      exp: 99,
      excited: 1,
      legacyShirtSize: 'XL',
    },
  },
];

describe('responseAggregations (R2)', () => {
  it('excludes cancelled registrations and resolves legacy positional keys and userDetails fallbacks', () => {
    const nameSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[0]);
    expect(nameSummary.respondentCount).toBe(3);
    expect(nameSummary.answeredCount).toBe(3);
    expect(nameSummary.completionPct).toBe(100);
    expect(nameSummary.textAnswers?.map((a) => a.value)).toEqual([
      'Ada Lovelace',
      'Alan Turing',
      'Grace Hopper',
    ]);
  });

  it('aggregates select and multiselect fields (splitting arrays and comma strings)', () => {
    const roleSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[2]);
    expect(roleSummary.kind).toBe('choice');
    expect(roleSummary.options).toEqual([
      { option: 'Frontend', count: 0, percentage: 0 },
      { option: 'Backend', count: 2, percentage: 67 },
      { option: 'Fullstack', count: 0, percentage: 0 },
      { option: 'Student', count: 1, percentage: 33 },
    ]);

    const topicsSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[3]);
    expect(topicsSummary.kind).toBe('choice');
    expect(topicsSummary.options).toEqual([
      { option: 'AI', count: 3, percentage: 100 },
      { option: 'Web', count: 1, percentage: 33 },
      { option: 'Cloud', count: 1, percentage: 33 },
    ]);
  });

  it('computes number min/max/average and rating distributions', () => {
    const expSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[4]);
    expect(expSummary.kind).toBe('number');
    expect(expSummary.numberStats?.min).toBe(0);
    expect(expSummary.numberStats?.max).toBe(10);
    expect(expSummary.numberStats?.average).toBe(5);

    const ratingSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[5]);
    expect(ratingSummary.kind).toBe('rating');
    expect(ratingSummary.ratingAverage).toBe(4.7);
    expect(ratingSummary.ratingDistribution?.find((b) => b.rating === 5)?.count).toBe(2);
    expect(ratingSummary.ratingDistribution?.find((b) => b.rating === 4)?.count).toBe(1);
  });

  it('sorts date answers chronologically and boolean checkboxes into Yes/No', () => {
    const checkboxSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[6]);
    expect(checkboxSummary.options).toEqual([
      { option: 'Yes', count: 1, percentage: 50 },
      { option: 'No', count: 1, percentage: 50 },
    ]);

    const dateSummary = summarizeQuestion(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[7]);
    expect(dateSummary.kind).toBe('date');
    expect(dateSummary.textAnswers?.map((a) => a.value)).toEqual(['2026-11-19', '2026-11-20']);
  });

  it('collects orphaned responses from removed fields while ignoring known/legacy mapped keys', () => {
    const orphans = collectOrphanResponses(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].registrationId).toBe('reg-1');
    expect(orphans[0].attendeeName).toBe('Ada Lovelace');
    expect(orphans[0].entries).toEqual([
      { key: 'legacyShirtSize', label: 'Legacy Shirt Size', value: 'M' },
    ]);
  });

  it('groups responses by a selected field and re-aggregates other questions per group', () => {
    const groups = groupResponses(SAMPLE_REGISTRATIONS, SAMPLE_FIELDS[2], SAMPLE_FIELDS);
    expect(groups.map((g) => ({ groupValue: g.groupValue, count: g.count }))).toEqual([
      { groupValue: 'Backend', count: 2 },
      { groupValue: 'Student', count: 1 },
    ]);

    const backendGroup = groups[0];
    const backendExp = backendGroup.summaries.find((s) => s.field.id === 'exp');
    expect(backendExp?.numberStats?.average).toBe(7.5);
  });
});
