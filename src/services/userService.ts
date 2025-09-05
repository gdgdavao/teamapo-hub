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
  limit,
  startAfter
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser as deleteAuthUser
} from 'firebase/auth';
import { auth, db, storage, functions } from '../config/firebase';
import { User } from '../types';

export interface UserWithMetadata extends User {
  lastLogin?: Date;
  isActive?: boolean;
  registrationCount?: number;
  eventsOrganized?: number;
  totalRevenue?: number;
}

export class UserService {
  private static readonly USERS_COLLECTION = 'users';
  private static readonly PROFILE_PICTURES_PATH = 'profile-pictures';

  /**
   * Get all users with optional filtering and pagination
   */
  static async getAllUsers(options?: {
    role?: 'organizer' | 'admin';
    limit?: number;
    startAfter?: string;
    searchTerm?: string;
  }): Promise<UserWithMetadata[]> {
    try {
      let usersQuery = query(collection(db, this.USERS_COLLECTION));

      // Add role filter
      if (options?.role) {
        usersQuery = query(usersQuery, where('role', '==', options.role));
      }

      // Add ordering
      usersQuery = query(usersQuery, orderBy('createdAt', 'desc'));

      // Add pagination
      if (options?.limit) {
        usersQuery = query(usersQuery, limit(options.limit));
      }

      if (options?.startAfter) {
        const startAfterDoc = await getDoc(doc(db, this.USERS_COLLECTION, options.startAfter));
        if (startAfterDoc.exists()) {
          usersQuery = query(usersQuery, startAfter(startAfterDoc));
        }
      }

      const snapshot = await getDocs(usersQuery);
      let users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserWithMetadata));

      // Apply search filter client-side for better UX
      if (options?.searchTerm) {
        const searchLower = options.searchTerm.toLowerCase();
        users = users.filter(user => 
          user.displayName.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          (user.organization && user.organization.toLowerCase().includes(searchLower))
        );
      }

      // Enhance with metadata
      const enhancedUsers = await Promise.all(
        users.map(user => this.enhanceUserWithMetadata(user))
      );

      return enhancedUsers;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Enhance user data with additional metadata
   */
  private static async enhanceUserWithMetadata(user: User): Promise<UserWithMetadata> {
    try {
      // Get registration count
      const registrationsQuery = query(
        collection(db, 'registrations'),
        where('userDetails.email', '==', user.email)
      );
      const registrationsSnapshot = await getDocs(registrationsQuery);

      // Get events organized (for organizers)
      let eventsOrganized = 0;
      if (user.role === 'organizer') {
        const eventsQuery = query(
          collection(db, 'events'),
          where('organizer.uid', '==', user.uid)
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        eventsOrganized = eventsSnapshot.size;
      }

      // Calculate total revenue from user's registrations
      let totalRevenue = 0;
      registrationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.paymentStatus === 'paid') {
          totalRevenue += data.totalAmount || 0;
        }
      });

      return {
        ...user,
        registrationCount: registrationsSnapshot.size,
        eventsOrganized,
        totalRevenue,
        isActive: true, // You can implement more complex logic here
        lastLogin: user.updatedAt?.toDate?.() || new Date()
      };
    } catch (error) {
      console.warn('Error enhancing user metadata:', error);
      return {
        ...user,
        registrationCount: 0,
        eventsOrganized: 0,
        totalRevenue: 0,
        isActive: true
      };
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<UserWithMetadata | null> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const user = {
          uid: userSnap.id,
          ...userSnap.data()
        } as User;
        
        return await this.enhanceUserWithMetadata(user);
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw new Error('Failed to fetch user');
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  /**
   * Upload user profile picture
   */
  static async uploadProfilePicture(userId: string, imageFile: File): Promise<string> {
    try {
      const imageRef = ref(storage, `${this.PROFILE_PICTURES_PATH}/${userId}/${imageFile.name}`);
      const snapshot = await uploadBytes(imageRef, imageFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update user profile with new photo URL
      await this.updateUserProfile(userId, {
        photoURL: downloadURL
      });

      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw new Error('Failed to upload profile picture');
    }
  }

  /**
   * Create a new user account (admin only)
   */
  static async createUser(data: {
    email: string;
    password: string;
    displayName: string;
    role: 'organizer' | 'admin';
    organization?: string;
    phoneNumber?: string;
  }): Promise<User> {
    try {
      // Use Firebase Function for user creation to avoid auth state issues
      const createUserFunction = httpsCallable(functions, 'createUser');
      const result = await createUserFunction(data);
      
      const response = result.data as { success: boolean; user?: User; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to create user');
      }
      
      return response.user!;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Delete user account (admin only)
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      // Use Firebase Function to properly delete user and all associated data
      const deleteUserFunction = httpsCallable(functions, 'deleteUser');
      const result = await deleteUserFunction({ userId });
      
      const response = result.data as { success: boolean; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Suspend/reactivate user account
   */
  static async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      await updateDoc(userRef, {
        isActive,
        updatedAt: serverTimestamp()
      });

      // If suspending, you might want to revoke sessions via Firebase Function
      if (!isActive) {
        try {
          const suspendUserFunction = httpsCallable(functions, 'suspendUser');
          await suspendUserFunction({ userId });
        } catch (error) {
          console.warn('Could not revoke user sessions:', error);
        }
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      throw new Error('Failed to toggle user status');
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(): Promise<{
    totalUsers: number;
    totalOrganizers: number;
    totalAdmins: number;
    activeUsers: number;
    newUsersThisMonth: number;
  }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        allUsersSnapshot,
        organizersSnapshot,
        adminsSnapshot,
        newUsersSnapshot
      ] = await Promise.all([
        getDocs(collection(db, this.USERS_COLLECTION)),
        getDocs(query(collection(db, this.USERS_COLLECTION), where('role', '==', 'organizer'))),
        getDocs(query(collection(db, this.USERS_COLLECTION), where('role', '==', 'admin'))),
        getDocs(query(
          collection(db, this.USERS_COLLECTION),
          where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
        ))
      ]);

      // Count active users (those with recent activity)
      let activeUsers = 0;
      allUsersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const isActive = data.isActive !== false; // Default to true if not set
        if (isActive) activeUsers++;
      });

      return {
        totalUsers: allUsersSnapshot.size,
        totalOrganizers: organizersSnapshot.size,
        totalAdmins: adminsSnapshot.size,
        activeUsers,
        newUsersThisMonth: newUsersSnapshot.size
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw new Error('Failed to fetch user stats');
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error sending password reset:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Get users by role with pagination
   */
  static async getUsersByRole(
    role: 'organizer' | 'admin',
    options?: { limit?: number; startAfter?: string }
  ): Promise<UserWithMetadata[]> {
    try {
      let usersQuery = query(
        collection(db, this.USERS_COLLECTION),
        where('role', '==', role),
        orderBy('createdAt', 'desc')
      );

      if (options?.limit) {
        usersQuery = query(usersQuery, limit(options.limit));
      }

      if (options?.startAfter) {
        const startAfterDoc = await getDoc(doc(db, this.USERS_COLLECTION, options.startAfter));
        if (startAfterDoc.exists()) {
          usersQuery = query(usersQuery, startAfter(startAfterDoc));
        }
      }

      const snapshot = await getDocs(usersQuery);
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));

      // Enhance with metadata
      const enhancedUsers = await Promise.all(
        users.map(user => this.enhanceUserWithMetadata(user))
      );

      return enhancedUsers;
    } catch (error) {
      console.error('Error fetching users by role:', error);
      throw new Error('Failed to fetch users by role');
    }
  }

  /**
   * Search users by name or email
   */
  static async searchUsers(searchTerm: string, limit: number = 20): Promise<UserWithMetadata[]> {
    try {
      // Get all users and filter client-side for better search experience
      // In production, you might want to use Algolia or similar for full-text search
      const allUsers = await this.getAllUsers({ limit: 100 });
      
      const searchLower = searchTerm.toLowerCase();
      const filteredUsers = allUsers.filter(user =>
        user.displayName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.organization && user.organization.toLowerCase().includes(searchLower))
      );

      return filteredUsers.slice(0, limit);
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error('Failed to search users');
    }
  }

  /**
   * Bulk update user roles (admin only)
   */
  static async bulkUpdateUserRoles(
    userIds: string[], 
    newRole: 'organizer' | 'admin'
  ): Promise<void> {
    try {
      const updatePromises = userIds.map(userId =>
        this.updateUserProfile(userId, { role: newRole })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error bulk updating user roles:', error);
      throw new Error('Failed to bulk update user roles');
    }
  }

  /**
   * Get user activity summary
   */
  static async getUserActivity(userId: string): Promise<{
    eventsRegistered: number;
    eventsAttended: number;
    eventsOrganized: number;
    certificatesEarned: number;
    totalSpent: number;
    lastActivity: Date | null;
  }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const [
        registrationsSnapshot,
        attendedSnapshot,
        eventsSnapshot,
        certificatesSnapshot
      ] = await Promise.all([
        getDocs(query(
          collection(db, 'registrations'),
          where('userDetails.email', '==', user.email)
        )),
        getDocs(query(
          collection(db, 'registrations'),
          where('userDetails.email', '==', user.email),
          where('attendanceStatus', '==', 'checked-in')
        )),
        getDocs(query(
          collection(db, 'events'),
          where('organizer.uid', '==', userId)
        )),
        getDocs(query(
          collection(db, 'certificates'),
          where('recipientEmail', '==', user.email)
        ))
      ]);

      // Calculate total spent
      let totalSpent = 0;
      registrationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.paymentStatus === 'paid') {
          totalSpent += data.totalAmount || 0;
        }
      });

      return {
        eventsRegistered: registrationsSnapshot.size,
        eventsAttended: attendedSnapshot.size,
        eventsOrganized: eventsSnapshot.size,
        certificatesEarned: certificatesSnapshot.size,
        totalSpent,
        lastActivity: user.lastLogin || null
      };
    } catch (error) {
      console.error('Error fetching user activity:', error);
      throw new Error('Failed to fetch user activity');
    }
  }
} 