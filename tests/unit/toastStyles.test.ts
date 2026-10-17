import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Toast notification design system', () => {
  const ROOT = process.cwd();
  const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
  const mainTsx = readFileSync(join(ROOT, 'src/main.tsx'), 'utf8');
  const appToasterTsx = readFileSync(join(ROOT, 'src/components/UI/AppToaster.tsx'), 'utf8');
  const uiBarrel = readFileSync(join(ROOT, 'src/components/UI/index.ts'), 'utf8');

  it('declares toast-bar and semantic variant styles in src/index.css', () => {
    expect(css).toContain('.toast-bar');
    expect(css).toContain('.toast-inner');
    expect(css).toContain('.toast-success');
    expect(css).toContain('.toast-error');
    expect(css).toContain('.toast-blank');
    expect(css).toContain('.toast-loading');
  });

  it('strictly bans side-stripe borders on toast classes', () => {
    const toastSectionMatch = css.match(/\/\* react-hot-toast styling:[\s\S]*?@layer utilities/);
    expect(toastSectionMatch).not.toBeNull();
    const toastCss = toastSectionMatch![0];

    expect(toastCss).not.toMatch(/border-left\s*:\s*[2-9]px/);
    expect(toastCss).not.toMatch(/border-right\s*:\s*[2-9]px/);
  });

  it('uses cross-browser backdrop filter and Google Sans typography', () => {
    expect(css).toContain('-webkit-backdrop-filter');
    expect(css).toContain('backdrop-filter');
    expect(css).toContain("theme('fontFamily.google')");
  });

  it('exports AppToaster from the UI primitives barrel and mounts it in main.tsx', () => {
    expect(uiBarrel).toContain("export { default as AppToaster } from './AppToaster';");
    expect(mainTsx).toContain("import { AppToaster } from './components/UI';");
    expect(mainTsx).toContain('<AppToaster />');
  });

  it('provides safe-area awareness and a 48px touch-target dismiss button', () => {
    expect(appToasterTsx).toContain('env(safe-area-inset-top');
    expect(appToasterTsx).toContain('min-h-control');
    expect(appToasterTsx).toContain('min-w-control');
    expect(appToasterTsx).toContain('aria-label="Dismiss notification"');
  });

  it('sets responsive adaptive placement between mobile and desktop', () => {
    expect(appToasterTsx).toContain("useMediaQuery('(min-width: 640px)')");
    expect(appToasterTsx).toContain("isDesktop ? 'top-right' : 'top-center'");
  });
});
