import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Form Builder Space Maximization & Ergonomics', () => {
  const formBuilderPath = join(process.cwd(), 'src/pages/events/components/FormBuilder.tsx');
  const formBuilderSource = readFileSync(formBuilderPath, 'utf8');

  const eventEditorPath = join(process.cwd(), 'src/pages/events/EventEditorPage.tsx');
  const eventEditorSource = readFileSync(eventEditorPath, 'utf8');

  describe('EventEditorPage Canvas Real Estate', () => {
    it('enables fullWidth on AppShell to unlock wide viewport width', () => {
      expect(eventEditorSource).toContain('fullWidth={true}');
    });

    it('allocates wider column ratio on large viewports', () => {
      expect(eventEditorSource).toContain('lg:col-span-3 xl:col-span-2 2xl:col-span-2');
      expect(eventEditorSource).toContain('lg:col-span-9 xl:col-span-10 2xl:col-span-10');
    });

    it('adapts step container padding to not constrain the form builder', () => {
      expect(eventEditorSource).toContain('currentStep === 4 ? "p-3 sm:p-5" : "px-6 py-6"');
      expect(eventEditorSource).toContain('currentStep === 4 ? "w-full" : "max-w-4xl"');
    });
  });

  describe('FormBuilder View Modes and Ergonomics', () => {
    it('defines desktopViewMode state with split, editor, and preview options', () => {
      expect(formBuilderSource).toContain("useState<'split' | 'editor' | 'preview'>('split')");
    });

    it('renders desktop canvas switcher pills with high accessibility', () => {
      expect(formBuilderSource).toContain('Split View (Side-by-Side)');
      expect(formBuilderSource).toContain('Focus Editor (Full Width)');
      expect(formBuilderSource).toContain('Attendee Preview');
    });

    it('features a compact, space-saving quick-add chip bar', () => {
      expect(formBuilderSource).toContain('flex flex-wrap items-center gap-1.5 sm:gap-2');
    });

    it('does not use banned thick left-side border stripes per design rules', () => {
      // /impeccable: No thick side-accent borders (border-l-4)
      expect(formBuilderSource).not.toContain('border-l-4');
      expect(formBuilderSource).toContain('border-2 border-primary bg-white shadow-md ring-2 ring-primary/10');
    });

    it('allocates full card width for question title prompt', () => {
      expect(formBuilderSource).toContain('Question Title / Prompt');
      expect(formBuilderSource).toContain('grid grid-cols-1 sm:grid-cols-2 gap-4');
    });
  });
});
