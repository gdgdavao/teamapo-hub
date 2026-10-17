import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf8');
}

describe('Event Editor Navigation, Venue Google Maps, and Review CTAs', () => {
  const editorSource = read('src', 'pages', 'events', 'EventEditorPage.tsx');
  const registrationSource = read('src', 'pages', 'registration', 'RegistrationPage.tsx');
  const venuePickerPath = join(ROOT, 'src', 'pages', 'events', 'components', 'VenueLocationPicker.tsx');
  const venuePickerSource = existsSync(venuePickerPath) ? read('src', 'pages', 'events', 'components', 'VenueLocationPicker.tsx') : '';

  describe('Edit Mode Navigation', () => {
    it('removes Back to Events button in edit mode header actions while keeping Back to Event Details', () => {
      // In edit mode (isEditMode && targetEventId), Back to Events must NOT be present
      expect(editorSource).toContain('title="Back to Event Details"');
      expect(editorSource).toContain('to={`/events/${targetEventId}`}');

      // Check edit mode actions block inside AppShell actions
      const actionsStart = editorSource.indexOf('actions=');
      const editBlockStart = editorSource.indexOf('{isEditMode && targetEventId ?', actionsStart);
      const editBlockEnd = editorSource.indexOf(') : (', editBlockStart);
      const editModeHeader = editorSource.substring(editBlockStart, editBlockEnd);

      expect(editModeHeader).not.toContain('title="Back to All Events"');
      expect(editModeHeader).not.toContain('Back to Events');
      expect(editModeHeader).toContain('Back to Event Details');
      expect(editModeHeader).toContain('Save Changes');
    });

    it('retains Back to Events link for create mode', () => {
      const editBlockEnd = editorSource.indexOf(') : (');
      const createModeHeader = editorSource.substring(editBlockEnd);
      expect(createModeHeader).toContain('title="Back to Events"');
      expect(createModeHeader).toContain('Save as Draft');
    });
  });

  describe('Basic Information Form Streamlining', () => {
    it('removes the contradictory Event Status dropdown from Basic Info', () => {
      expect(editorSource).not.toContain('id="eventStatus"');
      expect(editorSource).not.toContain('label="Event Status"');
      expect(editorSource).not.toContain('Current lifecycle state of this event');
    });

    it('keeps Registration Status selector in Basic Info', () => {
      expect(editorSource).toContain('id="registrationStatus"');
      expect(editorSource).toContain('label="Registration Status"');
    });
  });

  describe('Venue Geoapify & Leaflet Map Integration', () => {
    it('creates and imports VenueLocationPicker in EventEditorPage', () => {
      expect(existsSync(venuePickerPath)).toBe(true);
      expect(editorSource).toContain("import VenueLocationPicker from './components/VenueLocationPicker';");
      expect(editorSource).toContain('<VenueLocationPicker');
    });

    it('VenueLocationPicker integrates Geoapify Autocomplete and Leaflet interactive map', () => {
      expect(venuePickerSource).toContain('searchPlaces');
      expect(venuePickerSource).toContain('reverseGeocode');
      expect(venuePickerSource).toContain('getOpenStreetMapUrl');
      expect(venuePickerSource).toContain('venueCoordinates');
      expect(venuePickerSource).toContain('venuePlaceId');
      expect(venuePickerSource).toContain('venueMapsUrl');
      expect(venuePickerSource).toContain('<LeafletMap');
      expect(venuePickerSource).toContain('Open-source fallback active');
      // No proprietary Google Maps script injection
      expect(venuePickerSource).not.toContain('maps.googleapis.com/maps/api/js');
      expect(venuePickerSource).not.toContain('google.maps.places');
    });

    it('VenueLocationPicker adheres to WCAG 2.2 AA and Design System tokens', () => {
      expect(venuePickerSource).toContain('min-h-control');
      expect(venuePickerSource).toContain('border-outline-variant');
      expect(venuePickerSource).toContain('rounded-lg');
    });

    it('Registration Page reflects Leaflet map preview and OpenStreetMap link', () => {
      expect(registrationSource).toContain('View on OpenStreetMap');
      expect(registrationSource).toContain('<LeafletMap');
      expect(registrationSource).toContain('min-h-[48px]');
      expect(registrationSource).toMatch(/event\.venue\.coordinates \|\| event\.venue\.address/);
      // No Google Maps iframe embed
      expect(registrationSource).not.toContain('https://www.google.com/maps/embed');
    });
  });

  describe('Review and Publish CTA Streamlining', () => {
    it('removes contradictory dual "Update Details" and "Publish Changes" buttons in review step', () => {
      expect(editorSource).not.toContain('Update Details');
      expect(editorSource).not.toContain('Publish Changes');
    });

    it('renders single "Update Event" CTA for already published events in review card', () => {
      expect(editorSource).toContain('Update Event');
      expect(editorSource).toContain('Your event is live. Changes will be saved and visible to attendees immediately.');
    });

    it('renders "Save as Draft" and "Publish Event" CTAs for draft events', () => {
      expect(editorSource).toContain('Publish your event to make it live for attendee registrations');
      expect(editorSource).toContain('Save as Draft');
      expect(editorSource).toContain('Publish Event');
    });
  });
});
