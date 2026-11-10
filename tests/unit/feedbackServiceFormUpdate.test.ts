import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackService } from '../../src/services/feedbackService';
import { FormField } from '../../src/types';

const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  deleteDoc: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: () => 'SERVER_TIMESTAMP_MOCK',
  Timestamp: class MockTimestamp {
    seconds = 0;
    nanoseconds = 0;
  }
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {}
}));

describe('FeedbackService.updateFeedbackForm undefined sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('strips all undefined fields and nested validation undefineds before calling setDoc', async () => {
    const rawFields: FormField[] = [
      {
        id: 'field_1',
        type: 'text',
        label: 'What did you learn?',
        required: true,
        options: undefined,
        placeholder: undefined,
        description: undefined,
        gridSize: undefined,
        validation: {
          minLength: undefined,
          maxLength: 100,
          pattern: undefined
        }
      },
      {
        id: 'field_2',
        type: 'radio',
        label: 'Will you attend next time?',
        required: false,
        options: ['Yes', 'No', 'Other...'],
        placeholder: undefined,
        description: undefined
      }
    ];

    await FeedbackService.updateFeedbackForm('event_c6dzpNS14RxTer8F8Ppd', rawFields);

    expect(mockDoc).toHaveBeenCalledWith({}, 'events/event_c6dzpNS14RxTer8F8Ppd/forms/feedback');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    const callArgs = mockSetDoc.mock.calls[0];
    const payload = callArgs[1];

    expect(payload.type).toBe('feedback');
    expect(payload.updatedAt).toBe('SERVER_TIMESTAMP_MOCK');
    expect(Array.isArray(payload.fields)).toBe(true);

    const sanitizedField1 = payload.fields[0];
    expect(sanitizedField1.id).toBe('field_1');
    expect(sanitizedField1.type).toBe('text');
    expect(sanitizedField1.required).toBe(true);
    expect('options' in sanitizedField1).toBe(false);
    expect('placeholder' in sanitizedField1).toBe(false);
    expect('description' in sanitizedField1).toBe(false);
    expect('gridSize' in sanitizedField1).toBe(false);

    expect(sanitizedField1.validation).toEqual({ maxLength: 100 });
    expect('minLength' in sanitizedField1.validation).toBe(false);
    expect('pattern' in sanitizedField1.validation).toBe(false);

    const sanitizedField2 = payload.fields[1];
    expect(sanitizedField2.id).toBe('field_2');
    expect(sanitizedField2.options).toEqual(['Yes', 'No', 'Other...']);
    expect('placeholder' in sanitizedField2).toBe(false);
    expect('description' in sanitizedField2).toBe(false);

    // Deep assertion: Absolutely no undefined anywhere in the payload
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('undefined');
  });
});
