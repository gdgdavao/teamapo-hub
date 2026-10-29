import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  limit,
  setDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { logger } from '../utils/logger';
import { EventAnalytics } from '../types';
import { computeGrowthPct } from '../utils/growth';
import { countWithinWindow } from '../utils/analyticsBuckets';
import { toDateSafe } from '../utils/dateUtils';
import { swrCache } from '../utils/swrCache';

export interface DashboardStats {
  totalEvents: number;
  totalRegistrations: number;
  pendingApprovals: number;
  certificatesIssued: number;
  upcomingEvents: number;
  monthlyGrowth: {
    events: number | null;
    registrations: number | null;
    certificates: number | null;
  };
  totalRevenue: number;
  pendingPayments: number;
}

export interface PromoCodeUsage {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number;
  currentUses: number;
  usageCount: number; // From registrations
  remainingUses?: number;
  totalDiscount: number; // From registrations
  revenue: number; // From registrations
  isActive: boolean;
  validFrom: any;
  validUntil: any;
  isExpired: boolean;
}

/**
 * Event-level statistics returned by AnalyticsService.getEventStats(eventId).
 *
 * Single source of truth for registration counts:
 * - `registrations`: total non-placeholder registration documents for the event.
 * - `activeRegistrations`: non-placeholder registrations excluding `attendanceStatus === 'cancelled'`
 *   (includes `registered`, `confirmed`, `checked-in`, and `no-show` because no-shows held a seat).
 */
export interface EventStats {
  registrations: number;
  activeRegistrations: number;
  checkedIn: number;
  noShows: number;
  revenue: number;
  feedbackResponses: number;
  averageRating: number;
  certificatesIssued: number;
  promoCodeStats: {
    totalUsed: number;
    totalDiscount: number;
    topCodes: PromoCodeUsage[];
    allCodes: PromoCodeUsage[]; // All promo codes with details
    revenueWithPromo: number;
    revenueWithoutPromo: number;
  };
}

export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
}

export class AnalyticsService {
  private static readonly EVENTS_COLLECTION = 'events';
  private static readonly REGISTRATIONS_COLLECTION = 'registrations';
  private static readonly CERTIFICATES_COLLECTION = 'certificates';
  private static readonly FEEDBACK_COLLECTION = 'feedback';
  private static readonly PAYMENT_PROOFS_COLLECTION = 'paymentProofs';
  private static readonly ANALYTICS_COLLECTION = 'analytics';

  /**
   * Get comprehensive dashboard statistics
   *
   * Four reads, not ten. This used to fan out to six extra range queries —
   * this-month and last-month over events, registrations and certificates —
   * plus two `issuedAt` fallbacks to `createdAt`, all alongside the three full
   * collection reads it already held. Every one of those numbers was derivable
   * from snapshots already in hand, so each extra query was a document read
   * billed per visit and an index dependency, for a value that could not differ.
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    return swrCache.getOrFetch(
      'stats:dashboard',
      async () => {
        try {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

          const [eventsSnapshot, registrationsSnapshot, certificatesSnapshot] =
            await Promise.all([
              getDocs(collection(db, this.EVENTS_COLLECTION)),
              getDocs(collection(db, this.REGISTRATIONS_COLLECTION)), // firestore:unscoped-ok - admin platform totals
              getDocs(collection(db, this.CERTIFICATES_COLLECTION)), // firestore:unscoped-ok - admin platform totals
            ]);

          // Helper function to filter out placeholder documents
          const filterPlaceholderDocs = (docs: any[]) => {
            return docs.filter(doc => {
              const data = doc.data();
              const docId = doc.id;
              // Exclude documents with _placeholder: true or IDs starting with underscore
              return !data._placeholder && !docId.startsWith('_');
            });
          };

          // Filter out placeholder documents from all snapshots
          const realEventsData = filterPlaceholderDocs(eventsSnapshot.docs);
          const realRegistrationsData = filterPlaceholderDocs(registrationsSnapshot.docs);
          const realCertificatesData = filterPlaceholderDocs(certificatesSnapshot.docs);

          // Derive upcoming events directly from realEventsData without a 4th Firestore round-trip
          const nowTime = now.getTime();
          const upcomingEventsCount = realEventsData.filter((doc) => {
            const data = doc.data();
            const start = toDateSafe(data.startDate);
            return data.isPublished && start !== null && start.getTime() > nowTime;
          }).length;

          // Calculate revenue from registrations and pending counts
          let totalRevenue = 0;
          let pendingPayments = 0;
          realRegistrationsData.forEach(doc => {
            const data = doc.data();
            if (data.paymentStatus === 'paid') {
              totalRevenue += data.totalAmount || 0;
            } else if (data.paymentStatus === 'pending') {
              // count registrations with pending payment
              pendingPayments += 1;
            }
          });

          // For approvals, align with pending payments as a proxy in current flow
          const pendingApprovals = pendingPayments;

          const certTimestamp = (doc: any) => doc.issuedAt ?? doc.createdAt;
          const eventTimes = realEventsData.map((doc) => doc.data().createdAt);
          const regTimes = realRegistrationsData.map((doc) => doc.data().registrationDate);
          const certTimes = realCertificatesData.map((doc) => certTimestamp(doc.data()));

          const eventsThisMonth = countWithinWindow(eventTimes, startOfMonth);
          const eventsLastMonth = countWithinWindow(eventTimes, startOfLastMonth, endOfLastMonth);
          const registrationsThisMonth = countWithinWindow(regTimes, startOfMonth);
          const registrationsLastMonth = countWithinWindow(regTimes, startOfLastMonth, endOfLastMonth);
          const certificatesThisMonth = countWithinWindow(certTimes, startOfMonth);
          const certificatesLastMonth = countWithinWindow(certTimes, startOfLastMonth, endOfLastMonth);

          const growthPct = computeGrowthPct;

          const eventsGrowth = growthPct(eventsThisMonth, eventsLastMonth);
          const registrationsGrowth = growthPct(registrationsThisMonth, registrationsLastMonth);
          const certificatesGrowth = growthPct(certificatesThisMonth, certificatesLastMonth);

          return {
            totalEvents: realEventsData.length,
            totalRegistrations: realRegistrationsData.length,
            pendingApprovals,
            certificatesIssued: realCertificatesData.length,
            upcomingEvents: upcomingEventsCount,
            monthlyGrowth: {
              events: eventsGrowth,
              registrations: registrationsGrowth,
              certificates: certificatesGrowth
            },
            totalRevenue,
            pendingPayments
          };
        } catch (error) {
          logger.error('Error fetching dashboard stats:', error);
          throw new Error('Failed to fetch dashboard stats');
        }
      },
      30_000
    );
  }

  /**
   * Resolve whether a registration redeemed a promo code across all persisted field shapes:
   * 1. `data.promoCode` (string, normalized to uppercase)
   * 2. `data.promoCodeId` / `data.pricing?.promoCodeId` (resolved against `eventPromoCodes`)
   * 3. `data.pricing?.promoCode` (string or `{ code: string }` object, normalized to uppercase)
   * 4. `discountAmount > 0` fallback (reverse-engineered against `eventPromoCodes` or `UNKNOWN_DISCOUNT_<amount>`)
   */
  static resolveAppliedPromo(
    data: Record<string, any>,
    eventPromoCodes: any[] = []
  ): { code: string; discount: number } | null {
    const rawDiscount =
      typeof data.discountAmount === 'number'
        ? data.discountAmount
        : typeof data.pricing?.discountAmount === 'number'
        ? data.pricing.discountAmount
        : 0;
    const discount = Math.max(0, rawDiscount);

    let codeKey = '';

    if (typeof data.promoCode === 'string' && data.promoCode.trim()) {
      codeKey = data.promoCode.trim().toUpperCase();
    }

    const promoId = data.promoCodeId ?? data.pricing?.promoCodeId;
    if (!codeKey && promoId !== undefined && promoId !== null && String(promoId).trim()) {
      const promoIdStr = String(promoId).trim();
      const matchingPromo = eventPromoCodes.find(
        (pc: any) =>
          pc &&
          (pc.id === promoIdStr ||
            (typeof pc.code === 'string' && pc.code.trim().toUpperCase() === promoIdStr.toUpperCase()))
      );
      codeKey = matchingPromo && typeof matchingPromo.code === 'string'
        ? matchingPromo.code.trim().toUpperCase()
        : promoIdStr.toUpperCase();
    }

    if (!codeKey && data.pricing?.promoCode) {
      if (typeof data.pricing.promoCode === 'string' && data.pricing.promoCode.trim()) {
        codeKey = data.pricing.promoCode.trim().toUpperCase();
      } else if (
        typeof data.pricing.promoCode === 'object' &&
        typeof data.pricing.promoCode.code === 'string' &&
        data.pricing.promoCode.code.trim()
      ) {
        codeKey = data.pricing.promoCode.code.trim().toUpperCase();
      }
    }

    if (!codeKey && discount > 0) {
      const amount =
        typeof data.totalAmount === 'number'
          ? data.totalAmount
          : typeof data.pricing?.currentPrice === 'number'
          ? data.pricing.currentPrice
          : 0;
      const originalAmount =
        typeof data.originalAmount === 'number' && data.originalAmount > 0
          ? data.originalAmount
          : amount + discount;

      for (const promo of eventPromoCodes) {
        if (!promo || typeof promo.code !== 'string') continue;
        let expectedDiscount = 0;
        if (promo.discountType === 'percentage') {
          expectedDiscount = (originalAmount * Number(promo.discountValue || 0)) / 100;
        } else if (promo.discountType === 'fixed') {
          expectedDiscount = Number(promo.discountValue || 0);
        }

        if (Math.abs(expectedDiscount - discount) < 0.01) {
          codeKey = promo.code.trim().toUpperCase();
          break;
        }
      }

      if (!codeKey) {
        codeKey = `UNKNOWN_DISCOUNT_${discount}`;
      }
    }

    if (!codeKey) {
      return null;
    }

    return { code: codeKey, discount };
  }

  /**
   * Get detailed event statistics
   */
  static async getEventStats(eventId: string): Promise<EventStats> {
    return swrCache.getOrFetch(
      `stats:event:${eventId}`,
      async () => {
        try {
          const eventSnapshot = await getDoc(doc(db, this.EVENTS_COLLECTION, eventId));

          if (!eventSnapshot.exists()) {
            throw new Error('Event not found');
          }

          const [
            registrationsResult,
            feedbackResult,
            certificatesResult,
            promoConfigResult
          ] = await Promise.allSettled([
            getDocs(query(
              collection(db, this.REGISTRATIONS_COLLECTION),
              where('eventId', '==', eventId)
            )),
            getDocs(query(
              collection(db, this.FEEDBACK_COLLECTION),
              where('eventId', '==', eventId)
            )),
            getDocs(query(
              collection(db, this.CERTIFICATES_COLLECTION),
              where('eventId', '==', eventId)
            )),
            getDoc(doc(db, this.EVENTS_COLLECTION, eventId, 'config', 'promoCodes'))
          ]);

          const eventData = eventSnapshot.data();
          const promoConfigData =
            promoConfigResult.status === 'fulfilled' && promoConfigResult.value?.exists?.()
              ? promoConfigResult.value.data()
              : null;
          const eventPromoCodes = Array.isArray(promoConfigData?.promoCodes)
            ? promoConfigData.promoCodes
            : (eventData.promoCodes || []);

          // Helper function to filter out placeholder documents
          const filterPlaceholderDocs = (docs: any[]) => {
            return docs.filter(doc => {
              const data = doc.data();
              const docId = doc.id;
              // Exclude documents with _placeholder: true or IDs starting with underscore
              return !data._placeholder && !docId.startsWith('_');
            });
          };

          // Filter out placeholder documents
          const registrationsDocs = registrationsResult.status === 'fulfilled' ? registrationsResult.value.docs : [];
          const feedbackDocs = feedbackResult.status === 'fulfilled' ? feedbackResult.value.docs : [];
          const certificatesDocs = certificatesResult.status === 'fulfilled' ? certificatesResult.value.docs : [];

          const realRegistrations = filterPlaceholderDocs(registrationsDocs);
          const activeRegistrationsCount = realRegistrations.filter(
            doc => doc.data().attendanceStatus !== 'cancelled'
          ).length;
          const realCheckedInCount = realRegistrations.filter(doc => doc.data().attendanceStatus === 'checked-in').length;
          const realFeedback = filterPlaceholderDocs(feedbackDocs);
          const realCertificates = filterPlaceholderDocs(certificatesDocs);

      // Calculate revenue and promo code statistics
      let revenue = 0;
      let revenueWithPromo = 0;
      let revenueWithoutPromo = 0;
      let totalDiscount = 0;
      const promoCodeMap = new Map<string, { count: number; discount: number; revenue: number }>();

      realRegistrations.forEach(doc => {
        const data = doc.data();
        const isCancelled = data.attendanceStatus === 'cancelled';
        const isPaid = data.paymentStatus === 'paid';
        const amount = data.totalAmount || 0;

        const appliedPromo = !isCancelled
          ? this.resolveAppliedPromo(data, eventPromoCodes)
          : null;

        if (appliedPromo) {
          totalDiscount += appliedPromo.discount;
          const existing = promoCodeMap.get(appliedPromo.code) || { count: 0, discount: 0, revenue: 0 };
          promoCodeMap.set(appliedPromo.code, {
            count: existing.count + 1,
            discount: existing.discount + appliedPromo.discount,
            revenue: existing.revenue + (isPaid ? amount : 0)
          });
        }

        if (isPaid) {
          revenue += amount;
          if (appliedPromo) {
            revenueWithPromo += amount;
          } else {
            revenueWithoutPromo += amount;
          }
        }
      });

      // Create comprehensive promo code usage data
      const now = new Date();
      const promoCodeUsageMap = new Map<string, PromoCodeUsage>();
      
      // First, add all event promo codes (even if unused)
      eventPromoCodes.forEach((promoCode: any) => {
        const rawCode = typeof promoCode.code === 'string' ? promoCode.code.trim() : '';
        const normalizedCode = rawCode.toUpperCase();
        const validUntilDate = toDateSafe(promoCode.validUntil);
        const _validFromDate = toDateSafe(promoCode.validFrom);
        const isExpired = validUntilDate ? validUntilDate < now : false;
        const usageStats =
          promoCodeMap.get(normalizedCode) ||
          promoCodeMap.get(rawCode) ||
          { count: 0, discount: 0, revenue: 0 };
        
        promoCodeUsageMap.set(normalizedCode || rawCode, {
          code: normalizedCode || rawCode,
          name: promoCode.name || normalizedCode || rawCode,
          description: promoCode.description,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue ?? 0,
          maxUses: promoCode.maxUses,
          currentUses: usageStats.count, // Use actual usage from registrations
          usageCount: usageStats.count,
          remainingUses: promoCode.maxUses ? Math.max(0, promoCode.maxUses - usageStats.count) : undefined,
          totalDiscount: usageStats.discount,
          revenue: usageStats.revenue,
          isActive: Boolean(promoCode.isActive),
          validFrom: promoCode.validFrom ?? null,
          validUntil: promoCode.validUntil ?? null,
          isExpired
        });
      });

      // Add any promo codes found in registrations that might not be in the event's promo codes
      Array.from(promoCodeMap.entries()).forEach(([code, stats]) => {
        if (!promoCodeUsageMap.has(code)) {
          promoCodeUsageMap.set(code, {
            code,
            name: code,
            description: 'Used promo code (details not available)',
            discountType: 'fixed' as const,
            discountValue: 0,
            currentUses: stats.count,
            usageCount: stats.count,
            totalDiscount: stats.discount,
            revenue: stats.revenue,
            isActive: false,
            validFrom: null,
            validUntil: null,
            isExpired: true
          });
        }
      });

      // Convert to array and sort
      const allPromoCodes = Array.from(promoCodeUsageMap.values())
        .sort((a, b) => {
          // Sort by usage count (descending), then by name
          if (b.usageCount !== a.usageCount) {
            return b.usageCount - a.usageCount;
          }
          return a.name.localeCompare(b.name);
        });

      // Take top 5 used codes for the summary, but keep all for the detailed view
      const topCodes = allPromoCodes.slice(0, 5);

      // Calculate no-shows properly - only count those explicitly marked as no-show
      const noShowRegistrations = realRegistrations.filter(doc => {
        const data = doc.data();
        return data.attendanceStatus === 'no-show';
      });

      // Calculate average rating
      let totalRating = 0;
      let ratingCount = 0;
      realFeedback.forEach(doc => {
        const data = doc.data();
        if (data.overallRating) {
          totalRating += data.overallRating;
          ratingCount++;
        }
      });

      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      return {
        registrations: realRegistrations.length,
        activeRegistrations: activeRegistrationsCount,
        checkedIn: realCheckedInCount,
        noShows: noShowRegistrations.length, // Only count explicit no-shows
        revenue,
        feedbackResponses: realFeedback.length,
        averageRating: Math.round(averageRating * 10) / 10,
        certificatesIssued: realCertificates.length,
        promoCodeStats: {
          totalUsed: promoCodeMap.size > 0 ? Array.from(promoCodeMap.values()).reduce((sum, stats) => sum + stats.count, 0) : 0,
          totalDiscount,
          topCodes,
          allCodes: allPromoCodes,
          revenueWithPromo,
          revenueWithoutPromo
        }
        };
      } catch (error) {
        logger.error('Error fetching event stats:', error);
        throw new Error('Failed to fetch event stats');
      }
    },
    30_000
  );
}

  /**
   * Get comprehensive event analytics (using Firebase Function for complex calculations)
   */
  static async getEventAnalytics(eventId: string): Promise<EventAnalytics> {
    try {
      const getEventAnalytics = httpsCallable(functions, 'getEventAnalytics');
      const result = await getEventAnalytics({ eventId });
      
      const response = result.data as { success: boolean; analytics: EventAnalytics; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to get event analytics');
      }
      
      return response.analytics;
    } catch (error) {
      logger.error('Error getting event analytics:', error);
      // Fallback to basic stats if function fails
      const basicStats = await this.getEventStats(eventId);
      return {
        eventId,
        registrationStats: {
          totalRegistrations: basicStats.registrations,
          paidRegistrations: 0,
          freeRegistrations: basicStats.registrations,
          revenue: basicStats.revenue,
          refunds: 0
        },
        attendanceStats: {
          checkedIn: basicStats.checkedIn,
          noShows: basicStats.noShows,
          attendanceRate: basicStats.registrations > 0 ? (basicStats.checkedIn / basicStats.registrations) * 100 : 0
        },
        feedbackStats: {
          totalResponses: basicStats.feedbackResponses,
          averageRating: basicStats.averageRating,
          responseRate: basicStats.registrations > 0 ? (basicStats.feedbackResponses / basicStats.registrations) * 100 : 0
        },
        certificateStats: {
          issued: basicStats.certificatesIssued,
          verified: 0
        },
        demographics: {
          organizations: {},
          skills: {},
          locations: {}
        },
        timeline: {
          registrationsByDate: {},
          checkInsByHour: {}
        },
        lastUpdated: Timestamp.fromDate(new Date())
      };
    }
  }

  /**
   * Get analytics for multiple events
   */
  static async getMultipleEventAnalytics(eventIds: string[]): Promise<Record<string, EventStats>> {
    try {
      const analyticsPromises = eventIds.map(eventId => 
        this.getEventStats(eventId).then(stats => ({ eventId, stats }))
      );
      
      const results = await Promise.all(analyticsPromises);
      
      return results.reduce((acc, { eventId, stats }) => {
        acc[eventId] = stats;
        return acc;
      }, {} as Record<string, EventStats>);
    } catch (error) {
      logger.error('Error fetching multiple event analytics:', error);
      throw new Error('Failed to fetch multiple event analytics');
    }
  }

  /**
   * Get top performing events
   */
  static async getTopPerformingEvents(limitCount: number = 5): Promise<Array<{
    eventId: string;
    eventTitle: string;
    registrations: number;
    revenue: number;
    averageRating: number;
  }>> {
    try {
      // Get all events first
      const eventsSnapshot = await getDocs(query(
        collection(db, this.EVENTS_COLLECTION),
        where('isPublished', '==', true),
        orderBy('currentAttendees', 'desc'),
        limit(limitCount * 2) // Get more to filter later
      ));

      // Get stats for each event
      const eventStatsPromises = eventsSnapshot.docs.map(async doc => {
        const eventData = doc.data();
        const stats = await this.getEventStats(doc.id);
        
        return {
          eventId: doc.id,
          eventTitle: eventData.title,
          registrations: stats.registrations,
          revenue: stats.revenue,
          averageRating: stats.averageRating
        };
      });

      const eventStats = await Promise.all(eventStatsPromises);
      
      // Sort by registrations and take top N
      return eventStats
        .sort((a, b) => b.registrations - a.registrations)
        .slice(0, limitCount);
    } catch (error) {
      logger.error('Error fetching top performing events:', error);
      throw new Error('Failed to fetch top performing events');
    }
  }

  /**
   * Get revenue analytics by time period
   */
  static async getRevenueAnalytics(timeRange: AnalyticsTimeRange): Promise<{
    totalRevenue: number;
    revenueByEvent: Array<{ eventId: string; eventTitle: string; revenue: number }>;
    revenueByDate: Record<string, number>;
  }> {
    try {
      // Get approved payment proofs in the time range
      const proofsQuery = query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        where('verificationStatus', '==', 'approved'),
        where('verifiedAt', '>=', Timestamp.fromDate(timeRange.startDate)),
        where('verifiedAt', '<=', Timestamp.fromDate(timeRange.endDate))
      );
      
      const proofsSnapshot = await getDocs(proofsQuery);
      
      let totalRevenue = 0;
      const revenueByEvent: Record<string, { eventTitle: string; revenue: number }> = {};
      const revenueByDate: Record<string, number> = {};
      
      proofsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const amount = data.ticketPrice || 0;
        const eventId = data.eventId;
        const eventTitle = data.eventTitle || 'Unknown Event';
        const date = data.verifiedAt?.toDate?.()?.toISOString().split('T')[0];
        
        totalRevenue += amount;
        
        if (eventId) {
          if (!revenueByEvent[eventId]) {
            revenueByEvent[eventId] = { eventTitle, revenue: 0 };
          }
          revenueByEvent[eventId].revenue += amount;
        }
        
        if (date) {
          revenueByDate[date] = (revenueByDate[date] || 0) + amount;
        }
      });
      
      return {
        totalRevenue,
        revenueByEvent: Object.entries(revenueByEvent).map(([eventId, data]) => ({
          eventId,
          eventTitle: data.eventTitle,
          revenue: data.revenue
        })),
        revenueByDate
      };
    } catch (error) {
      logger.error('Error fetching revenue analytics:', error);
      throw new Error('Failed to fetch revenue analytics');
    }
  }

  /**
   * Cache analytics data for better performance
   */
  static async cacheEventAnalytics(eventId: string): Promise<void> {
    try {
      const analytics = await this.getEventAnalytics(eventId);
      
      const analyticsRef = doc(db, this.ANALYTICS_COLLECTION, eventId);
      await setDoc(analyticsRef, {
        ...analytics,
        cachedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
    } catch (error) {
      logger.error('Error caching event analytics:', error);
      // Don't throw error for caching failure
    }
  }
} 