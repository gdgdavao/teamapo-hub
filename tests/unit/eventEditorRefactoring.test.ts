import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Event Editor & Feedback Tab Refactoring', () => {
  const eventEditorPath = join(process.cwd(), 'src/pages/events/EventEditorPage.tsx');
  const eventEditorSource = readFileSync(eventEditorPath, 'utf8');

  const feedbackTabPath = join(process.cwd(), 'src/pages/events/workspace/tabs/FeedbackTab.tsx');
  const feedbackTabSource = readFileSync(feedbackTabPath, 'utf8');

  const eventServicePath = join(process.cwd(), 'src/services/eventService.ts');
  const eventServiceSource = readFileSync(eventServicePath, 'utf8');

  describe('EventEditorPage streamlining', () => {
    it('has exactly 6 wizard steps excluding promo codes and feedback forms', () => {
      expect(eventEditorSource).toContain("title: 'Basic Information'");
      expect(eventEditorSource).toContain("title: 'Date & Venue'");
      expect(eventEditorSource).toContain("title: 'Speaker Profiles'");
      expect(eventEditorSource).toContain("title: 'Tickets & Pricing'");
      expect(eventEditorSource).toContain("title: 'Registration Form'");
      expect(eventEditorSource).toContain("title: 'Review & Publish'");

      // Must NOT contain Promo Codes or Feedback Form as wizard steps
      expect(eventEditorSource).not.toMatch(/title:\s*'Promo Codes'/);
      expect(eventEditorSource).not.toMatch(/title:\s*'Feedback Form'/);
    });

    it('removes PromoCodeManager from EventEditorPage', () => {
      expect(eventEditorSource).not.toContain('import PromoCodeManager');
      expect(eventEditorSource).not.toContain('<PromoCodeManager');
      expect(eventEditorSource).not.toContain('renderPromoCodeStep');
    });

    it('renders only registration form in form builder step', () => {
      expect(eventEditorSource).toContain('renderRegistrationFormStep');
      expect(eventEditorSource).not.toContain("renderFormBuilderStep('feedback')");
      expect(eventEditorSource).not.toContain("activeFormType");
    });

    it('cleans up review step by removing promo codes and feedback form references', () => {
      expect(eventEditorSource).not.toContain('formData.promoCodes.length');
      expect(eventEditorSource).not.toContain('formData.feedbackForm.length');
      expect(eventEditorSource).not.toContain('Post-Event Feedback');
    });
  });

  describe('FeedbackTab form management & locking', () => {
    it('declares 3 distinct subtabs for questions, summary, and individual responses', () => {
      expect(feedbackTabSource).toContain("'questions'");
      expect(feedbackTabSource).toContain("'summary'");
      expect(feedbackTabSource).toContain("'individual'");
      expect(feedbackTabSource).toContain('Form Questions');
    });

    it('integrates FormBuilder and starter template in FeedbackTab', () => {
      expect(feedbackTabSource).toContain("import FormBuilder from '../../components/FormBuilder'");
      expect(feedbackTabSource).toContain('STARTER_FEEDBACK_FIELDS');
      expect(feedbackTabSource).toContain('handleLoadStarterTemplate');
      expect(feedbackTabSource).toContain('<FormBuilder');
    });

    it('locks questions editing when feedback responses already exist', () => {
      expect(feedbackTabSource).toContain('isFormLocked');
      expect(feedbackTabSource).toContain('feedbackList.length > 0');
      expect(feedbackTabSource).toContain('Feedback Form Locked');
      expect(feedbackTabSource).toContain('Read Only');
    });

    it('saves updated form questions via FeedbackService', () => {
      expect(feedbackTabSource).toContain('FeedbackService.updateFeedbackForm');
      expect(feedbackTabSource).toContain('handleSaveFeedbackForm');
    });
  });

  describe('EventService data invariants', () => {
    it('creates feedback form safely without undefined', () => {
      // removeUndefinedValues sanitizes the fields array before writing to Firestore
      expect(eventServiceSource).toContain('this.removeUndefinedValues(eventData.feedbackForm ?? [])');
    });

    it('treats promoCodes and feedbackForm as optional in EventFormData', () => {
      expect(eventServiceSource).toContain('promoCodes?: PromoCode[]');
      expect(eventServiceSource).toContain('feedbackForm?: FormField[]');
    });
  });
});
