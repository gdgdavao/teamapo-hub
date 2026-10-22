import React, { useCallback, useEffect, useState } from 'react';
import { TagIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../../../../components/UI';
import { useAuth } from '../../../../contexts/AuthContext';
import { EventService } from '../../../../services/eventService';
import { PromoCode, TicketType } from '../../../../types';
import { logger } from '../../../../utils/logger';
import PromoCodeManager from '../../components/PromoCodeManager';

interface PromoCodesTabProps {
  /** Required. The tab renders inside /events/:eventId; see AttendeesTab. */
  eventId: string;
}

/**
 * Promo codes are stored in the protected `events/{eventId}/config/promoCodes`
 * subcollection document (with legacy fallback to `event.promoCodes`).
 * PromoCodeManager is presentational — it takes the array and three callbacks —
 * so this panel owns loading and saving and nothing else.
 */
const PromoCodesTab: React.FC<PromoCodesTabProps> = ({ eventId }) => {
  const { userProfile } = useAuth();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [event, loadedPromoCodes] = await Promise.all([
        EventService.getEvent(eventId),
        typeof EventService.getEventPromoCodes === 'function'
          ? EventService.getEventPromoCodes(eventId)
          : Promise.resolve(undefined)
      ]);
      setPromoCodes(loadedPromoCodes ?? event?.promoCodes ?? []);
      setTicketTypes(event?.ticketTypes ?? []);
    } catch (error) {
      logger.error('Error loading promo codes:', error);
      toast.error('Failed to load promo codes. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Optimistic so the list reorders instantly, then the event document is the
   * single source of truth and we refetch rather than trust local state.
   */
  const save = useCallback(
    async (next: PromoCode[], failureMessage: string) => {
      const previous = promoCodes;
      setPromoCodes(next);
      try {
        await EventService.updatePromoCodes(eventId, next);
        await load();
      } catch (error) {
        logger.error('Error saving promo codes:', error);
        setPromoCodes(previous);
        toast.error(failureMessage);
      }
    },
    [eventId, promoCodes, load]
  );

  const handleCreatePromoCode = (
    data: Omit<PromoCode, 'id' | 'currentUses' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = { toDate: () => new Date() } as any;
    void save(
      [
        ...promoCodes,
        {
          ...data,
          id: `promo_${crypto.randomUUID()}`,
          currentUses: 0,
          // EventEditorPage's create step omits createdBy, so sanitizePromoCodes
          // silently strips it and the code has no author on record.
          createdBy: userProfile?.uid ?? '',
          createdAt: now,
          updatedAt: now
        }
      ],
      'Failed to create promo code'
    );
  };

  const handleUpdatePromoCode = (id: string, updates: Partial<PromoCode>) => {
    void save(
      promoCodes.map((promo) =>
        promo.id === id
          ? { ...promo, ...updates, updatedAt: { toDate: () => new Date() } as any }
          : promo
      ),
      'Failed to update promo code'
    );
  };

  const handleDeletePromoCode = (id: string) => {
    void save(
      promoCodes.filter((promo) => promo.id !== id),
      'Failed to delete promo code'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ticketTypes.length === 0 && (
        <div
          className="rounded-xl border border-warning/40 bg-warning-container/20 p-4 sm:p-5"
          role="status"
        >
          <div className="flex items-start gap-3">
            <TagIcon className="h-5 w-5 shrink-0 text-warning-amber mt-0.5" aria-hidden="true" />
            <p className="text-sm text-on-warning-container">
              <strong>Tip:</strong> Create ticket types first. A promo code can be
              limited to specific ticket types, and this event has none yet.
            </p>
          </div>
        </div>
      )}

      <PromoCodeManager
        promoCodes={promoCodes}
        ticketTypes={ticketTypes}
        onCreatePromoCode={handleCreatePromoCode}
        onUpdatePromoCode={handleUpdatePromoCode}
        onDeletePromoCode={handleDeletePromoCode}
      />
    </div>
  );
};

export default PromoCodesTab;