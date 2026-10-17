import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Polyfill HTMLDialogElement for jsdom
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function (this: HTMLDialogElement) {
    this.open = false;
  };
}

// Unmount anything a test rendered before the next one starts. Without this,
// DOM left mounted by a previous file leaks into the next and failures point
// at the wrong component.
afterEach(() => {
  cleanup();
});