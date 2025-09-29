import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  Timestamp,
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { Feedback, FormField } from '../types';

export interface FeedbackSubmission {
  eventId: string;
  userId?: string;
  registrationId?: string;
  userEmail: string;
  userName: string;
  responses: Record<string, any>;
  overallRating: number;
  submittedAt: Date;
}

export interface FeedbackAnalytics {
  eventId: string;
  totalResponses: number;
  averageRating: number;
  responseRate: number;
  ratingDistribution: Record<string, number>;
  commonKeywords: string[];
  sentimentScore: number;
  topCompliments: string[];
  topComplaints: string[];
}

export class FeedbackService {
  private static readonly FEEDBACK_COLLECTION = 'feedback';
  private static readonly EVENTS_COLLECTION = 'events';
  private static readonly REGISTRATIONS_COLLECTION = 'registrations';

  /**
   * Generate feedback URL for an event
   */
  static generateFeedbackUrl(eventId: string, registrationId?: string, userEmail?: string, userName?: string): string {
    const baseUrl = window.location.origin;
    const feedbackUrl = `${baseUrl}/feedback/${eventId}`;
    
    // Add query parameters for better UX
    const params = new URLSearchParams();
    if (registrationId) params.append('registrationId', registrationId);
    if (userEmail) params.append('email', userEmail);
    if (userName) params.append('name', userName);
    
    return params.toString() ? `${feedbackUrl}?${params.toString()}` : feedbackUrl;
  }

  /**
   * Generate feedback URL for server-side use
   */
  static generateServerFeedbackUrl(eventId: string, registrationId?: string, userEmail?: string, userName?: string): string {
    const baseUrl = 'https://gdgdavao.org'; // Production URL
    const feedbackUrl = `${baseUrl}/feedback/${eventId}`;
    
    // Add query parameters for better UX
    const params = new URLSearchParams();
    if (registrationId) params.append('registrationId', registrationId);
    if (userEmail) params.append('email', userEmail);
    if (userName) params.append('name', userName);
    
    return params.toString() ? `${feedbackUrl}?${params.toString()}` : feedbackUrl;
  }

  /**
   * Send feedback request email
   */
  static async sendFeedbackRequest(data: {
    eventId: string;
    userEmail: string;
    userName: string;
    eventTitle: string;
    registrationId?: string;
  }): Promise<void> {
    try {
      const sendFeedbackRequest = httpsCallable(functions, 'sendFeedbackRequest');
      
      // Generate feedback URL
      const feedbackUrl = this.generateServerFeedbackUrl(
        data.eventId,
        data.registrationId,
        data.userEmail,
        data.userName
      );

      await sendFeedbackRequest({
        eventId: data.eventId,
        userEmail: data.userEmail,
        userName: data.userName,
        eventTitle: data.eventTitle,
        registrationId: data.registrationId,
        feedbackUrl: feedbackUrl
      });
    } catch (error) {
      console.error('Error sending feedback request:', error);
      throw new Error('Failed to send feedback request');
    }
  }

  /**
   * Submit feedback for an event
   */
  static async submitFeedback(feedbackData: {
    eventId: string;
    userId?: string;
    registrationId?: string;
    userEmail: string;
    userName: string;
    responses: Record<string, any>;
    overallRating: number;
    contentRating?: number;
    organizationRating?: number;
    venueRating?: number;
    speakerRatings?: Array<{ speakerId: string; rating: number; comments?: string }>;
    comments?: string;
    suggestions?: string;
    wouldRecommend?: boolean;
    futureTopics?: string[];
  }): Promise<string> {
    try {
      // Generate feedback ID
      const feedbackRef = doc(collection(db, this.FEEDBACK_COLLECTION));
      const feedbackId = feedbackRef.id;

      // Create feedback document
      const feedback: Omit<Feedback, 'id'> = {
        eventId: feedbackData.eventId,
        userId: feedbackData.userId || '',
        registrationId: feedbackData.registrationId || '',
        overallRating: feedbackData.overallRating,
        contentRating: feedbackData.contentRating || feedbackData.overallRating,
        organizationRating: feedbackData.organizationRating || feedbackData.overallRating,
        venueRating: feedbackData.venueRating || feedbackData.overallRating,
        speakerRatings: feedbackData.speakerRatings || [],
        comments: feedbackData.comments || '',
        suggestions: feedbackData.suggestions || '',
        wouldRecommend: feedbackData.wouldRecommend || false,
        futureTopics: feedbackData.futureTopics || [],
        submittedAt: serverTimestamp() as any
      };

      // Add custom responses to the feedback
      const feedbackWithResponses = {
        ...feedback,
        customResponses: feedbackData.responses,
        userEmail: feedbackData.userEmail,
        userName: feedbackData.userName
      };

      await setDoc(feedbackRef, feedbackWithResponses);

      // Update registration to mark feedback as submitted
      if (feedbackData.registrationId) {
        try {
          const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, feedbackData.registrationId);
          await updateDoc(registrationRef, {
            feedbackSubmitted: true,
            feedbackId: feedbackId,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.warn('Could not update registration with feedback status:', error);
        }
      }

      // Trigger analytics update via Cloud Function
      try {
        const updateFeedbackAnalytics = httpsCallable(functions, 'updateFeedbackAnalytics');
        await updateFeedbackAnalytics({ eventId: feedbackData.eventId });
      } catch (error) {
        console.warn('Could not update feedback analytics:', error);
      }

      return feedbackId;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  }

  /**
   * Get all feedback for an event
   */
  static async getEventFeedback(eventId: string): Promise<Feedback[]> {
    try {
      const feedbackQuery = query(
        collection(db, this.FEEDBACK_COLLECTION),
        where('eventId', '==', eventId),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(feedbackQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Feedback));
    } catch (error) {
      console.error('Error fetching event feedback:', error);
      throw new Error('Failed to fetch event feedback');
    }
  }

  /**
   * Get feedback analytics for an event
   */
  static async getFeedbackAnalytics(eventId: string): Promise<FeedbackAnalytics> {
    try {
      const feedbackList = await this.getEventFeedback(eventId);
      
      if (feedbackList.length === 0) {
        return {
          eventId,
          totalResponses: 0,
          averageRating: 0,
          responseRate: 0,
          ratingDistribution: {},
          commonKeywords: [],
          sentimentScore: 0,
          topCompliments: [],
          topComplaints: []
        };
      }

      // Calculate basic metrics
      const totalResponses = feedbackList.length;
      const totalRating = feedbackList.reduce((sum, feedback) => sum + feedback.overallRating, 0);
      const averageRating = totalRating / totalResponses;

      // Calculate rating distribution
      const ratingDistribution: Record<string, number> = {};
      feedbackList.forEach(feedback => {
        const rating = feedback.overallRating.toString();
        ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
      });

      // Get total registrations for response rate calculation
      const registrationsQuery = query(
        collection(db, this.REGISTRATIONS_COLLECTION),
        where('eventId', '==', eventId)
      );
      const registrationsSnapshot = await getDocs(registrationsQuery);
      const totalRegistrations = registrationsSnapshot.size;
      const responseRate = totalRegistrations > 0 ? (totalResponses / totalRegistrations) * 100 : 0;

      // Extract keywords from comments
      const allComments = feedbackList
        .map(feedback => feedback.comments)
        .filter(comment => comment && comment.length > 0)
        .join(' ');

      const commonKeywords = this.extractKeywords(allComments);

      // Simple sentiment analysis
      const sentimentScore = this.calculateSentimentScore(allComments);

      // Extract top compliments and complaints
      const { compliments, complaints } = this.categorizeComments(feedbackList);

      return {
        eventId,
        totalResponses,
        averageRating: Math.round(averageRating * 10) / 10,
        responseRate: Math.round(responseRate * 10) / 10,
        ratingDistribution,
        commonKeywords,
        sentimentScore,
        topCompliments: compliments.slice(0, 5),
        topComplaints: complaints.slice(0, 5)
      };
    } catch (error) {
      console.error('Error fetching feedback analytics:', error);
      throw new Error('Failed to fetch feedback analytics');
    }
  }

  /**
   * Get feedback form for an event
   */
  static async getFeedbackForm(eventId: string): Promise<FormField[]> {
    try {
      const formRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/feedback`);
      const formSnap = await getDoc(formRef);
      
      if (formSnap.exists()) {
        const formData = formSnap.data();
        return formData.fields || [];
      }
      
      // Return default feedback form if none exists
      return this.getDefaultFeedbackForm();
    } catch (error) {
      console.error('Error fetching feedback form:', error);
      return this.getDefaultFeedbackForm();
    }
  }

  /**
   * Update feedback form for an event
   */
  static async updateFeedbackForm(eventId: string, fields: FormField[]): Promise<void> {
    try {
      const formRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/feedback`);
      await setDoc(formRef, {
        type: 'feedback',
        fields,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating feedback form:', error);
      throw new Error('Failed to update feedback form');
    }
  }

  /**
   * Get feedback by user
   */
  static async getUserFeedback(userEmail: string): Promise<Feedback[]> {
    try {
      const feedbackQuery = query(
        collection(db, this.FEEDBACK_COLLECTION),
        where('userEmail', '==', userEmail),
        orderBy('submittedAt', 'desc')
      );
      const snapshot = await getDocs(feedbackQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Feedback));
    } catch (error) {
      console.error('Error fetching user feedback:', error);
      throw new Error('Failed to fetch user feedback');
    }
  }

  /**
   * Get feedback statistics across all events
   */
  static async getOverallFeedbackStats(): Promise<{
    totalFeedback: number;
    averageRating: number;
    responseRate: number;
    recommendationRate: number;
  }> {
    try {
      const feedbackSnapshot = await getDocs(collection(db, this.FEEDBACK_COLLECTION));
      const registrationsSnapshot = await getDocs(collection(db, this.REGISTRATIONS_COLLECTION));

      if (feedbackSnapshot.size === 0) {
        return {
          totalFeedback: 0,
          averageRating: 0,
          responseRate: 0,
          recommendationRate: 0
        };
      }

      let totalRating = 0;
      let recommendCount = 0;

      feedbackSnapshot.docs.forEach(doc => {
        const data = doc.data();
        totalRating += data.overallRating || 0;
        if (data.wouldRecommend) recommendCount++;
      });

      const averageRating = totalRating / feedbackSnapshot.size;
      const responseRate = registrationsSnapshot.size > 0 
        ? (feedbackSnapshot.size / registrationsSnapshot.size) * 100 
        : 0;
      const recommendationRate = (recommendCount / feedbackSnapshot.size) * 100;

      return {
        totalFeedback: feedbackSnapshot.size,
        averageRating: Math.round(averageRating * 10) / 10,
        responseRate: Math.round(responseRate * 10) / 10,
        recommendationRate: Math.round(recommendationRate * 10) / 10
      };
    } catch (error) {
      console.error('Error fetching overall feedback stats:', error);
      throw new Error('Failed to fetch overall feedback stats');
    }
  }

  /**
   * Delete feedback (admin only)
   */
  static async deleteFeedback(feedbackId: string): Promise<void> {
    try {
      const feedbackRef = doc(db, this.FEEDBACK_COLLECTION, feedbackId);
      await deleteDoc(feedbackRef);
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw new Error('Failed to delete feedback');
    }
  }

  /**
   * Get default feedback form structure
   */
  private static getDefaultFeedbackForm(): FormField[] {
    return [
      {
        id: 'overall_rating',
        type: 'rating',
        label: 'Overall Event Rating',
        required: true,
        gridSize: 'full',
        description: 'Rate your overall experience with this event'
      },
      {
        id: 'content_rating',
        type: 'rating',
        label: 'Content Quality',
        required: true,
        gridSize: 'half',
        description: 'How would you rate the content quality?'
      },
      {
        id: 'organization_rating',
        type: 'rating',
        label: 'Event Organization',
        required: true,
        gridSize: 'half',
        description: 'How well was the event organized?'
      },
      {
        id: 'what_liked',
        type: 'textarea',
        label: 'What did you like most?',
        required: false,
        gridSize: 'full',
        description: 'Tell us what you enjoyed about the event'
      },
      {
        id: 'improvements',
        type: 'textarea',
        label: 'What could be improved?',
        required: false,
        gridSize: 'full',
        description: 'How can we make future events better?'
      },
      {
        id: 'recommend',
        type: 'radio',
        label: 'Would you recommend this event to others?',
        required: true,
        gridSize: 'full',
        options: ['Yes', 'No', 'Maybe']
      },
      {
        id: 'future_topics',
        type: 'textarea',
        label: 'Topics for future events',
        required: false,
        gridSize: 'full',
        description: 'What topics would you like to see in future events?'
      }
    ];
  }

  /**
   * Extract keywords from text
   */
  private static extractKeywords(text: string): string[] {
    if (!text) return [];

    // Simple keyword extraction - in production, you might use a more sophisticated NLP library
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Count word frequency
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Calculate sentiment score
   */
  private static calculateSentimentScore(text: string): number {
    if (!text) return 0;

    // Simple sentiment analysis - in production, you might use a proper sentiment analysis service
    const positiveWords = ['great', 'excellent', 'amazing', 'good', 'love', 'awesome', 'perfect', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'poor', 'disappointing', 'boring', 'worst'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });

    // Normalize to -1 to 1 scale
    return Math.max(-1, Math.min(1, score / words.length * 10));
  }

  /**
   * Categorize comments into compliments and complaints
   */
  private static categorizeComments(feedbackList: Feedback[]): { compliments: string[]; complaints: string[] } {
    const compliments: string[] = [];
    const complaints: string[] = [];

    feedbackList.forEach(feedback => {
      if (feedback.comments) {
        // Simple categorization based on rating
        if (feedback.overallRating >= 4) {
          compliments.push(feedback.comments);
        } else if (feedback.overallRating <= 2) {
          complaints.push(feedback.comments);
        }
      }
    });

    return { compliments, complaints };
  }
} 