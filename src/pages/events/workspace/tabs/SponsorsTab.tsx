import React, { useState, useEffect, useCallback } from 'react';
import { useAbility } from '@casl/react';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  GlobeAltIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { EventService } from '../../../../services/eventService';
import { Event, EventSponsor, PresetSponsorCategory } from '../../../../types';
import {
  Button,
  Input,
  Select,
  Badge,
  EmptyState,
  ConfirmationModal,
  LoadingSpinner,
} from '../../../../components/UI';
import PhotoUpload from '../../components/PhotoUpload';
import { asEvent } from '../../../../auth/ability';
import { logger } from '../../../../utils/logger';

interface SponsorsTabProps {
  eventId: string;
}

const PRESET_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'partner', label: 'Partner' },
  { value: 'community', label: 'Community Partner' },
  { value: 'venue', label: 'Venue Partner' },
  { value: 'media', label: 'Media Partner' },
  { value: 'custom', label: 'Other (Custom Category...)' },
];

const PRESET_CATEGORY_LABELS: Record<PresetSponsorCategory, string> = {
  sponsor: 'Sponsor',
  partner: 'Partner',
  community: 'Community Partner',
  venue: 'Venue Partner',
  media: 'Media Partner',
};

const isPresetCategory = (tier?: string): tier is PresetSponsorCategory =>
  Boolean(tier && Object.prototype.hasOwnProperty.call(PRESET_CATEGORY_LABELS, tier));

const formatSponsorTierLabel = (tier?: string): string => {
  if (!tier) return 'Sponsor';
  if (isPresetCategory(tier)) return PRESET_CATEGORY_LABELS[tier];
  return tier;
};

const getSponsorTierTone = (tier?: string): 'info' | 'success' | 'warning' | 'neutral' => {
  if (tier === 'partner' || tier === 'community') return 'success';
  if (tier === 'sponsor' || tier === 'venue') return 'info';
  if (tier === 'media') return 'neutral';
  return 'info';
};

const deriveNameFromFilename = (filename: string): string => {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
};

interface SponsorFormState {
  id: string;
  name: string;
  logoUrl: string;
  categorySelect: string;
  customCategory: string;
  websiteUrl: string;
}

const generateSponsorId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptySponsorDraft = (
  categorySelect = 'sponsor',
  customCategory = ''
): SponsorFormState => ({
  id: generateSponsorId(),
  name: '',
  logoUrl: '',
  categorySelect,
  customCategory,
  websiteUrl: '',
});

export const SponsorsTab: React.FC<SponsorsTabProps> = ({ eventId }) => {
  const ability = useAbility();
  const [event, setEvent] = useState<Event | null>(null);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SponsorFormState[]>(() => [createEmptySponsorDraft()]);
  const [pendingDeleteSponsor, setPendingDeleteSponsor] = useState<EventSponsor | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const eventData = await EventService.getEvent(eventId);
      setEvent(eventData);
      setSponsors(eventData?.sponsors ?? []);
    } catch (error) {
      logger.error('Error loading event sponsors:', error);
      toast.error('Failed to load sponsors & partners');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canUpdate = event ? ability.can('update', asEvent(event)) : false;

  const openAddForm = () => {
    setEditingId(null);
    setDrafts([createEmptySponsorDraft()]);
    setIsFormOpen(true);
  };

  const openEditForm = (sponsor: EventSponsor) => {
    const tier = sponsor.tier ?? 'sponsor';
    const preset = isPresetCategory(tier);
    setEditingId(sponsor.id);
    setDrafts([
      {
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        categorySelect: preset ? tier : 'custom',
        customCategory: preset ? '' : tier,
        websiteUrl: sponsor.websiteUrl ?? '',
      },
    ]);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setDrafts([createEmptySponsorDraft()]);
  };

  const updateDraft = (draftId: string, updater: (prev: SponsorFormState) => SponsorFormState) => {
    setDrafts((prev) => prev.map((d) => (d.id === draftId ? updater(d) : d)));
  };

  const addDraftRow = () => {
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        createEmptySponsorDraft(
          last?.categorySelect ?? 'sponsor',
          last?.customCategory ?? ''
        ),
      ];
    });
  };

  const removeDraftRow = (draftId: string) => {
    setDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== draftId) : prev));
  };

  const persistSponsors = async (nextSponsors: EventSponsor[], successMsg: string) => {
    try {
      setSaving(true);
      await EventService.updateEventSponsors(eventId, nextSponsors);
      setSponsors(nextSponsors);
      toast.success(successMsg);
      return true;
    } catch (error) {
      logger.error('Error saving sponsors:', error);
      toast.error('Failed to save sponsors & partners');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSingleLogoFileChange = async (draftId: string, file: File | null) => {
    if (!file) {
      updateDraft(draftId, (prev) => ({ ...prev, logoUrl: '' }));
      return;
    }
    try {
      setSaving(true);
      const uploadedUrl = await EventService.uploadSponsorLogo(eventId, draftId, file);
      const derivedName = deriveNameFromFilename(file.name);
      updateDraft(draftId, (prev) => ({
        ...prev,
        logoUrl: uploadedUrl,
        name: prev.name.trim() ? prev.name : derivedName,
      }));
      toast.success('Logo uploaded');
    } catch (error) {
      logger.error('Error uploading sponsor logo:', error);
      toast.error('Failed to upload logo image');
    } finally {
      setSaving(false);
    }
  };

  const handleMultiLogoFilesChange = async (targetDraftId: string, files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) {
      await handleSingleLogoFileChange(targetDraftId, files[0]);
      return;
    }

    try {
      setSaving(true);
      const targetDraft = drafts.find((d) => d.id === targetDraftId);
      const baseCategorySelect = targetDraft?.categorySelect ?? 'sponsor';
      const baseCustomCategory = targetDraft?.customCategory ?? '';

      const uploadTasks = files.map(async (file, idx) => {
        const rowId = idx === 0 ? targetDraftId : generateSponsorId();
        const uploadedUrl = await EventService.uploadSponsorLogo(eventId, rowId, file);
        return {
          rowId,
          uploadedUrl,
          derivedName: deriveNameFromFilename(file.name),
        };
      });

      const results = await Promise.all(uploadTasks);
      const [first, ...rest] = results;

      setDrafts((prev) => {
        const updatedExisting = prev.map((d) =>
          d.id === targetDraftId
            ? {
                ...d,
                logoUrl: first.uploadedUrl,
                name: d.name.trim() ? d.name : first.derivedName,
              }
            : d
        );

        const additionalRows: SponsorFormState[] = rest.map((item) => ({
          id: item.rowId,
          name: item.derivedName,
          logoUrl: item.uploadedUrl,
          categorySelect: baseCategorySelect,
          customCategory: baseCustomCategory,
          websiteUrl: '',
        }));

        return [...updatedExisting, ...additionalRows];
      });

      toast.success(`Uploaded ${results.length} sponsor logos`);
    } catch (error) {
      logger.error('Error uploading multiple sponsor logos:', error);
      toast.error('Failed to upload one or more logo images');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSponsors = async (e: React.FormEvent) => {
    e.preventDefault();

    const preparedItems: EventSponsor[] = [];

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const trimmedName = draft.name.trim();
      const trimmedLogo = draft.logoUrl.trim();
      const trimmedWebsite = draft.websiteUrl.trim();
      const resolvedTier =
        draft.categorySelect === 'custom'
          ? draft.customCategory.trim()
          : draft.categorySelect.trim();

      if (!trimmedName) {
        toast.error(
          drafts.length > 1
            ? `Please enter the organization name for Sponsor #${i + 1}`
            : 'Please enter the sponsor or partner name'
        );
        return;
      }

      if (!trimmedLogo) {
        toast.error(
          drafts.length > 1
            ? `Please upload a logo image for "${trimmedName}"`
            : 'Please upload a logo image'
        );
        return;
      }

      if (draft.categorySelect === 'custom' && !resolvedTier) {
        toast.error(
          drafts.length > 1
            ? `Please type a custom category for "${trimmedName}"`
            : 'Please type a custom category / tier'
        );
        return;
      }

      preparedItems.push({
        id: draft.id,
        name: trimmedName,
        logoUrl: trimmedLogo,
        tier: resolvedTier || 'sponsor',
        ...(trimmedWebsite ? { websiteUrl: trimmedWebsite } : {}),
      });
    }

    const nextSponsors = editingId
      ? sponsors.map((item) => (item.id === editingId ? preparedItems[0] : item))
      : [...sponsors, ...preparedItems];

    const successMessage = editingId
      ? 'Sponsor updated'
      : preparedItems.length > 1
        ? `Added ${preparedItems.length} sponsors & partners`
        : 'Sponsor added';

    const ok = await persistSponsors(nextSponsors, successMessage);
    if (ok) {
      closeForm();
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sponsors.length) return;
    const nextSponsors = [...sponsors];
    const [moved] = nextSponsors.splice(index, 1);
    nextSponsors.splice(targetIndex, 0, moved);
    await persistSponsors(nextSponsors, 'Order updated');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSponsor) return;
    const nextSponsors = sponsors.filter((s) => s.id !== pendingDeleteSponsor.id);
    const ok = await persistSponsors(nextSponsors, 'Sponsor removed');
    if (ok) {
      setPendingDeleteSponsor(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-12 text-center">
        <p className="text-on-surface-variant">Event not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface">Sponsors &amp; Partners</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Showcase event sponsors and community partners in the Kiosk Mode scrolling ticker and on the public registration page.
          </p>
        </div>
        {canUpdate && !isFormOpen && (
          <Button
            type="button"
            variant="filled"
            onClick={openAddForm}
            icon={<PlusIcon className="w-5 h-5" />}
          >
            Add Sponsors / Partners
          </Button>
        )}
      </div>

      {isFormOpen && canUpdate && (
        <form
          onSubmit={handleSaveSponsors}
          className="bg-surface rounded-2xl border border-outline-variant p-6 space-y-6 shadow-elevation-1"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-outline-variant pb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface">
                {editingId
                  ? 'Edit Sponsor / Partner'
                  : drafts.length > 1
                    ? `Add ${drafts.length} Sponsors / Partners`
                    : 'Add Sponsors / Partners'}
              </h3>
              {!editingId && (
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Tip: You can select or drag multiple logo files at once to auto-create rows, or click &ldquo;Add Another Sponsor&rdquo; below.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {drafts.map((draft, index) => (
              <div
                key={draft.id}
                className={`space-y-5 ${
                  drafts.length > 1
                    ? 'rounded-xl border border-outline-variant bg-surface-container-low/40 p-5'
                    : ''
                }`}
              >
                {drafts.length > 1 && (
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Sponsor #{index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeDraftRow(draft.id)}
                      disabled={saving}
                      icon={<TrashIcon className="w-4 h-4" />}
                    >
                      Remove Row
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Organization Name"
                    required
                    placeholder="e.g., Google, JetBrains, DICT Region XI"
                    value={draft.name}
                    onChange={(e) =>
                      updateDraft(draft.id, (prev) => ({ ...prev, name: e.target.value }))
                    }
                  />

                  <div className="space-y-4">
                    <Select
                      label="Category / Tier"
                      value={draft.categorySelect}
                      onChange={(e) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          categorySelect: e.target.value,
                        }))
                      }
                      options={PRESET_CATEGORY_OPTIONS}
                    />

                    {draft.categorySelect === 'custom' && (
                      <Input
                        label="Custom Category / Tier"
                        required
                        placeholder="e.g., Co-Presenter, Official Connectivity Partner"
                        value={draft.customCategory}
                        onChange={(e) =>
                          updateDraft(draft.id, (prev) => ({
                            ...prev,
                            customCategory: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-on-surface">
                      Upload Logo Image
                    </span>
                    <PhotoUpload
                      currentPhotoUrl={draft.logoUrl || undefined}
                      onPhotoChange={(file) => void handleSingleLogoFileChange(draft.id, file)}
                      onMultiPhotoChange={
                        !editingId
                          ? (files) => void handleMultiLogoFilesChange(draft.id, files)
                          : undefined
                      }
                      onPhotoRemove={() =>
                        updateDraft(draft.id, (prev) => ({ ...prev, logoUrl: '' }))
                      }
                      maxSize={5}
                      fit="contain"
                      multiple={!editingId}
                      placeholder={
                        !editingId ? 'Upload Logo(s)' : 'Upload Sponsor Logo'
                      }
                      helperText="Logos conform to their natural aspect ratio. Transparent PNG, WebP, or SVG works best on the white Kiosk ticker."
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Website URL (Optional)"
                      type="url"
                      placeholder="https://example.com"
                      hint="Attendees can click the logo on the public event page."
                      value={draft.websiteUrl}
                      onChange={(e) =>
                        updateDraft(draft.id, (prev) => ({
                          ...prev,
                          websiteUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant">
            <div>
              {!editingId && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={addDraftRow}
                  disabled={saving}
                  icon={<PlusIcon className="w-4 h-4" />}
                >
                  Add Another Sponsor
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outlined" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="filled" loading={saving}>
                {editingId
                  ? 'Save Changes'
                  : drafts.length > 1
                    ? `Add ${drafts.length} Sponsors to Event`
                    : 'Add to Event'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {sponsors.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-outline-variant p-8">
          <EmptyState
            icon={<HeartIcon className="w-6 h-6" />}
            title="No sponsors or partners added yet"
            description="Add your sponsors, venue hosts, and community partners so their logos appear in the Kiosk Mode scrolling ticker and on the public registration page."
            action={
              canUpdate && !isFormOpen ? (
                <Button
                  type="button"
                  variant="filled"
                  onClick={openAddForm}
                  icon={<PlusIcon className="w-5 h-5" />}
                >
                  Add Sponsors / Partners
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sponsors.map((sponsor, index) => {
            const tier = sponsor.tier ?? 'sponsor';
            return (
              <div
                key={sponsor.id}
                className="bg-surface rounded-2xl border border-outline-variant p-5 flex flex-col justify-between gap-4 shadow-elevation-1"
              >
                <div className="space-y-4">
                  {/* Natural-aspect logo showcase container */}
                  <div className="min-h-[96px] rounded-xl bg-surface-container-high border border-outline-variant p-4 flex items-center justify-center overflow-hidden">
                    <img
                      src={sponsor.logoUrl}
                      alt={sponsor.name}
                      loading="lazy"
                      decoding="async"
                      className="h-auto max-h-24 w-auto max-w-full object-contain sponsor-logo-contrast"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={getSponsorTierTone(tier)}>
                        {formatSponsorTierLabel(tier)}
                      </Badge>
                    </div>
                    <h3 className="text-base font-bold text-on-surface truncate mt-2">
                      {sponsor.name}
                    </h3>
                    {sponsor.websiteUrl && (
                      <a
                        href={sponsor.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1 truncate max-w-full"
                      >
                        <GlobeAltIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {sponsor.websiteUrl.replace(/^https?:\/\//i, '')}
                        </span>
                      </a>
                    )}
                  </div>
                </div>

                {canUpdate && (
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0 || saving}
                        aria-label={`Move ${sponsor.name} earlier`}
                        title="Move earlier"
                        className="min-h-control min-w-[48px] inline-flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 1)}
                        disabled={index === sponsors.length - 1 || saving}
                        aria-label={`Move ${sponsor.name} later`}
                        title="Move later"
                        className="min-h-control min-w-[48px] inline-flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowDownIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        onClick={() => openEditForm(sponsor)}
                        disabled={saving}
                        icon={<PencilSquareIcon className="w-4 h-4" />}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setPendingDeleteSponsor(sponsor)}
                        disabled={saving}
                        aria-label={`Remove ${sponsor.name}`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(pendingDeleteSponsor)}
        onClose={() => setPendingDeleteSponsor(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Sponsor / Partner"
        message={
          pendingDeleteSponsor
            ? `Remove "${pendingDeleteSponsor.name}" from this event's sponsors and partners?`
            : ''
        }
        confirmText="Remove"
        type="danger"
        isLoading={saving}
      />
    </div>
  );
};

export default SponsorsTab;
