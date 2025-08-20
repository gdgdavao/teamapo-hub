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
  startAfter,
  aggregateQuerySnapshot,
  count,
  sum
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { EventAnalytics } from '../types';

export interface DashboardStats {
  totalEvents: number;
  totalRegistrations: number;
  pendingApprovals: number;
  certificatesIssued: number;
  upcomingEvents: number;
  monthlyGrowth: {
    events: number;
    registrations: number;
    certificates: number;
  };
  totalRevenue: number;
  pendingPayments: number;
}

export interface EventStats {
  registrations: number;
  checkedIn: number;
  noShows: number;
  revenue: number;
  feedbackResponses: number;
  averageRating: number;
  certificatesIssued: number;
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
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get current date for time-based queries
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Run all queries in parallel for better performance
      const [
        eventsSnapshot,
        registrationsSnapshot,
        certificatesSnapshot,
        paymentProofsSnapshot,
        upcomingEventsSnapshot,
        monthlyEventsSnapshot,
        lastMonthEventsSnapshot,
        monthlyRegistrationsSnapshot,
        lastMonthRegistrationsSnapshot,
        monthlyCertificatesSnapshot,
        lastMonthCertificatesSnapshot
      ] = await Promise.all([
        // Total counts
        getDocs(collection(db, this.EVENTS_COLLECTION)),
        getDocs(collection(db, this.REGISTRATIONS_COLLECTION)),
        getDocs(collection(db, this.CERTIFICATES_COLLECTION)),
        getDocs(query(collection(db, this.PAYMENT_PROOFS_COLLECTION), where('verificationStatus', '==', 'pending'))),
        
        // Upcoming events (published and future)
        getDocs(query(
          collection(db, this.EVENTS_COLLECTION),
          where('isPublished', '==', true),
          where('startDate', '>', Timestamp.fromDate(now))
        )),
        
        // Monthly growth calculations
        getDocs(query(
          collection(db, this.EVENTS_COLLECTION),
          where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
        )),
        getDocs(query(
          collection(db, this.EVENTS_COLLECTION),
          where('createdAt', '>=', Timestamp.fromDate(startOfLastMonth)),
          where('createdAt', '<', Timestamp.fromDate(endOfLastMonth))
        )),
        getDocs(query(
          collection(db, this.REGISTRATIONS_COLLECTION),
          where('registrationDate', '>=', Timestamp.fromDate(startOfMonth))
        )),
        getDocs(query(
          collection(db, this.REGISTRATIONS_COLLECTION),
          where('registrationDate', '>=', Timestamp.fromDate(startOfLastMonth)),
          where('registrationDate', '<', Timestamp.fromDate(endOfLastMonth))
        )),
        getDocs(query(
          collection(db, this.CERTIFICATES_COLLECTION),
          where('issuedAt', '>=', Timestamp.fromDate(startOfMonth))
        )),
        getDocs(query(
          collection(db, this.CERTIFICATES_COLLECTION),
          where('issuedAt', '>=', Timestamp.fromDate(startOfLastMonth)),
          where('issuedAt', '<', Timestamp.fromDate(endOfLastMonth))
        ))
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
      const realUpcomingEventsData = filterPlaceholderDocs(upcomingEventsSnapshot.docs);

      // Filter monthly growth data
      const realMonthlyEventsData = filterPlaceholderDocs(monthlyEventsSnapshot.docs);
      const realLastMonthEventsData = filterPlaceholderDocs(lastMonthEventsSnapshot.docs);
      const realMonthlyRegistrationsData = filterPlaceholderDocs(monthlyRegistrationsSnapshot.docs);
      const realLastMonthRegistrationsData = filterPlaceholderDocs(lastMonthRegistrationsSnapshot.docs);
      const realMonthlyCertificatesData = filterPlaceholderDocs(monthlyCertificatesSnapshot.docs);
      const realLastMonthCertificatesData = filterPlaceholderDocs(lastMonthCertificatesSnapshot.docs);

      // Calculate revenue from approved payment proofs
      const approvedProofsSnapshot = await getDocs(query(
        collection(db, this.PAYMENT_PROOFS_COLLECTION),
        where('verificationStatus', '==', 'approved')
      ));

      let totalRevenue = 0;
      filterPlaceholderDocs(approvedProofsSnapshot.docs).forEach(doc => {
        const data = doc.data();
        totalRevenue += data.ticketPrice || 0;
      });

      // Calculate monthly growth percentages
      const currentMonthEvents = realMonthlyEventsData.length;
      const lastMonthEvents = realLastMonthEventsData.length;
      const currentMonthRegistrations = realMonthlyRegistrationsData.length;
      const lastMonthRegistrations = realLastMonthRegistrationsData.length;
      const currentMonthCertificates = realMonthlyCertificatesData.length;
      const lastMonthCertificates = realLastMonthCertificatesData.length;

      const eventsGrowth = lastMonthEvents > 0 
        ? ((currentMonthEvents - lastMonthEvents) / lastMonthEvents) * 100 
        : 0;
      const registrationsGrowth = lastMonthRegistrations > 0 
        ? ((currentMonthRegistrations - lastMonthRegistrations) / lastMonthRegistrations) * 100 
        : 0;
      const certificatesGrowth = lastMonthCertificates > 0 
        ? ((currentMonthCertificates - lastMonthCertificates) / lastMonthCertificates) * 100 
        : 0;

      return {
        totalEvents: realEventsData.length,
        totalRegistrations: realRegistrationsData.length,
        pendingApprovals: paymentProofsSnapshot.size, // Payment proofs don't have placeholder docs
        certificatesIssued: realCertificatesData.length,
        upcomingEvents: realUpcomingEventsData.length,
        monthlyGrowth: {
          events: Math.round(eventsGrowth),
          registrations: Math.round(registrationsGrowth),
          certificates: Math.round(certificatesGrowth)
        },
        totalRevenue,
        pendingPayments: paymentProofsSnapshot.size
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new Error('Failed to fetch dashboard stats');
    }
  }

  /**
   * Get detailed event statistics
   */
  static async getEventStats(eventId: string): Promise<EventStats> {
    try {
      const [
        registrationsSnapshot,
        checkedInSnapshot,
        feedbackSnapshot,
        certificatesSnapshot
      ] = await Promise.all([
        getDocs(query(
          collection(db, this.REGISTRATIONS_COLLECTION),
          where('eventId', '==', eventId)
        )),
        getDocs(query(
          collection(db, this.REGISTRATIONS_COLLECTION),
          where('eventId', '==', eventId),
          where('attendanceStatus', '==', 'checked-in')
        )),
        getDocs(query(
          collection(db, this.FEEDBACK_COLLECTION),
          where('eventId', '==', eventId)
        )),
        getDocs(query(
          collection(db, this.CERTIFICATES_COLLECTION),
          where('eventId', '==', eventId)
        ))
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

      // Filter out placeholder documents
      const realRegistrations = filterPlaceholderDocs(registrationsSnapshot.docs);
      const realCheckedIn = filterPlaceholderDocs(checkedInSnapshot.docs);
      const realFeedback = filterPlaceholderDocs(feedbackSnapshot.docs);
      const realCertificates = filterPlaceholderDocs(certificatesSnapshot.docs);

      // Calculate revenue for this event
      let revenue = 0;
      realRegistrations.forEach(doc => {
        const data = doc.data();
        if (data.paymentStatus === 'paid') {
          revenue += data.totalAmount || 0;
        }
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
        checkedIn: realCheckedIn.length,
        noShows: realRegistrations.length - realCheckedIn.length,
        revenue,
        feedbackResponses: realFeedback.length,
        averageRating: Math.round(averageRating * 10) / 10,
        certificatesIssued: realCertificates.length
      };
    } catch (error) {
      console.error('Error fetching event stats:', error);
      throw new Error('Failed to fetch event stats');
    }
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
      console.error('Error getting event analytics:', error);
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
        lastUpdated: serverTimestamp() as any
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
      console.error('Error fetching multiple event analytics:', error);
      throw new Error('Failed to fetch multiple event analytics');
    }
  }

  /**
   * Get top performing events
   */
  static async getTopPerformingEvents(limit: number = 5): Promise<Array<{
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
        limit(limit * 2) // Get more to filter later
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
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching top performing events:', error);
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
      console.error('Error fetching revenue analytics:', error);
      throw new Error('Failed to fetch revenue analytics');
    }
  }

  /**
   * Get user engagement analytics
   */
  static async getUserEngagementAnalytics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    repeatAttendees: number;
    averageEventsPerUser: number;
  }> {
    try {
      // Get all registrations
      const registrationsSnapshot = await getDocs(collection(db, this.REGISTRATIONS_COLLECTION));
      
      // Group by user email to find unique users and repeat attendees
      const userRegistrations: Record<string, number> = {};
      
      registrationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const userEmail = data.userDetails?.email;
        if (userEmail) {
          userRegistrations[userEmail] = (userRegistrations[userEmail] || 0) + 1;
        }
      });
      
      const totalUsers = Object.keys(userRegistrations).length;
      const repeatAttendees = Object.values(userRegistrations).filter(count => count > 1).length;
      const totalRegistrations = Object.values(userRegistrations).reduce((sum, count) => sum + count, 0);
      const averageEventsPerUser = totalUsers > 0 ? totalRegistrations / totalUsers : 0;
      
      // Consider users with more than 1 registration as active
      const activeUsers = repeatAttendees;
      
      return {
        totalUsers,
        activeUsers,
        repeatAttendees,
        averageEventsPerUser: Math.round(averageEventsPerUser * 100) / 100
      };
    } catch (error) {
      console.error('Error fetching user engagement analytics:', error);
      throw new Error('Failed to fetch user engagement analytics');
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
      console.error('Error caching event analytics:', error);
      // Don't throw error for caching failure
    }
  }
} 