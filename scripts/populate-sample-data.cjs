#!/usr/bin/env node

/**
 * Populate Firebase Emulator with Sample Data
 * This script creates realistic test data for development
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { join } = require('path');

const seedPassword = process.env.APOHUB_SEED_PASSWORD;
if (!seedPassword) throw new Error('APOHUB_SEED_PASSWORD is required for emulator data.');

console.log('🎯 Populating Firebase Emulator with Sample Data');
console.log('💡 This creates realistic test data for development');
console.log('');

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

// Initialize Firebase Admin for Emulator
let app;
try {
  const projectId = process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'demo-apohub';
  app = initializeApp({
    projectId
  });
  console.log(`✅ Connected to Firebase Emulator (project: ${projectId})`);
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

const db = getFirestore(app);
const auth = getAuth(app);

// Sample data generators
const generateSampleUsers = () => [
  {
    uid: 'admin-001',
    email: 'admin@example.test',
    displayName: 'John Admin',
    role: 'admin',
    organization: 'GDG Davao',
    phoneNumber: '+15550100001',
    bio: 'Lead organizer and admin for GDG Davao. Passionate about technology and community building.',
    skills: ['Event Management', 'Community Building', 'Public Speaking'],
    socialLinks: {
      linkedin: 'https://linkedin.com/in/johnadmin',
      twitter: 'https://twitter.com/johnadmin'
    },
    createdAt: Timestamp.fromDate(new Date('2024-01-15')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsCreated: 8
  },
  {
    uid: 'organizer-001',
    email: 'organizer.one@example.test',
    displayName: 'Maria Santos',
    role: 'organizer',
    organization: 'GDG Davao',
    phoneNumber: '+15550100002',
    bio: 'Frontend developer and event organizer. Loves React and helping others learn tech.',
    skills: ['React', 'JavaScript', 'Event Planning', 'Workshop Facilitation'],
    socialLinks: {
      github: 'https://github.com/mariasantos',
      linkedin: 'https://linkedin.com/in/mariasantos'
    },
    createdAt: Timestamp.fromDate(new Date('2024-02-01')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsCreated: 5
  },
  {
    uid: 'organizer-002',
    email: 'organizer.two@example.test',
    displayName: 'Carlos Rodriguez',
    role: 'organizer',
    organization: 'GDG Davao',
    phoneNumber: '+15550100003',
    bio: 'Full-stack developer specializing in Node.js and cloud technologies.',
    skills: ['Node.js', 'Cloud Computing', 'Database Design', 'API Development'],
    socialLinks: {
      github: 'https://github.com/carlosdev',
      twitter: 'https://twitter.com/carlosdev'
    },
    createdAt: Timestamp.fromDate(new Date('2024-03-10')),
    updatedAt: Timestamp.now(),
    isActive: true,
    eventsCreated: 3
  }
];

const generateSampleEvents = () => [
  {
    id: 'event-001',
    title: 'React Workshop: Building Modern Web Apps',
    description: 'Join us for a hands-on React workshop where you\'ll learn to build modern, responsive web applications. We\'ll cover hooks, state management, and best practices for React development. Perfect for beginners and intermediate developers looking to level up their React skills.',
    shortDescription: 'Learn React fundamentals and build modern web apps in this hands-on workshop.',
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    organizer: {
      uid: 'organizer-001',
      name: 'Maria Santos',
      email: 'organizer.one@example.test'
    },
    speakers: [
      {
        id: 'speaker-001',
        name: 'Maria Santos',
        title: 'Senior Frontend Developer',
        bio: 'React expert with 5+ years of experience',
        imageUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300',
        socialLinks: {
          linkedin: 'https://linkedin.com/in/mariasantos',
          github: 'https://github.com/mariasantos'
        }
      }
    ],
    startDate: Timestamp.fromDate(new Date('2025-01-20T09:00:00Z')),
    endDate: Timestamp.fromDate(new Date('2025-01-20T17:00:00Z')),
    timezone: 'Asia/Manila',
    venue: {
      type: 'physical',
      name: 'Tech Hub Davao',
      address: '123 Tech Street, Davao City',
      city: 'Davao City',
      coordinates: { lat: 7.073, lng: 125.612 },
      capacity: 50
    },
    ticketTypes: [
      {
        id: 'early-bird',
        name: 'Early Bird',
        price: 500,
        description: 'Limited early bird pricing',
        available: 20,
        sold: 15
      },
      {
        id: 'regular',
        name: 'Regular',
        price: 750,
        description: 'Regular admission',
        available: 30,
        sold: 8
      }
    ],
    tags: ['React', 'JavaScript', 'Frontend', 'Workshop', 'Web Development'],
    category: 'workshop',
    status: 'published',
    maxAttendees: 50,
    currentAttendees: 23,
    isPublished: true,
    registrationDeadline: Timestamp.fromDate(new Date('2025-01-18T23:59:59Z')),
    requirements: ['Laptop with Node.js installed', 'Basic JavaScript knowledge', 'Text editor (VS Code recommended)'],
    agenda: [
      {
        time: '09:00 - 09:30',
        title: 'Registration & Coffee',
        description: 'Welcome coffee and networking'
      },
      {
        time: '09:30 - 11:00',
        title: 'React Fundamentals',
        description: 'Components, props, and state basics'
      },
      {
        time: '11:15 - 12:30',
        title: 'Hooks Deep Dive',
        description: 'useState, useEffect, and custom hooks'
      },
      {
        time: '13:30 - 15:00',
        title: 'State Management',
        description: 'Context API and state management patterns'
      },
      {
        time: '15:15 - 16:30',
        title: 'Build a Project',
        description: 'Hands-on project building'
      },
      {
        time: '16:30 - 17:00',
        title: 'Q&A & Wrap-up',
        description: 'Questions and next steps'
      }
    ],
    createdAt: Timestamp.fromDate(new Date('2024-12-01')),
    updatedAt: Timestamp.now()
  },
  {
    id: 'event-002',
    title: 'Google I/O Extended Davao 2025',
    description: 'Join the biggest Google I/O Extended event in Davao! Experience the latest Google technologies, network with fellow developers, and get hands-on with cutting-edge tools and platforms. This full-day event features talks, workshops, and networking opportunities.',
    shortDescription: 'The biggest Google I/O Extended event in Davao with talks, workshops, and networking.',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
    organizer: {
      uid: 'admin-001',
      name: 'John Admin',
      email: 'admin@example.test'
    },
    speakers: [
      {
        id: 'speaker-002',
        name: 'John Admin',
        title: 'GDG Davao Organizer',
        bio: 'Community builder and tech evangelist',
        imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300'
      },
      {
        id: 'speaker-003',
        name: 'Sarah Tech',
        title: 'Google Developer Expert',
        bio: 'Machine Learning and AI specialist',
        imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300'
      }
    ],
    startDate: Timestamp.fromDate(new Date('2025-02-15T08:00:00Z')),
    endDate: Timestamp.fromDate(new Date('2025-02-15T18:00:00Z')),
    timezone: 'Asia/Manila',
    venue: {
      type: 'physical',
      name: 'Davao Convention Center',
      address: 'JP Laurel Ave, Davao City',
      city: 'Davao City',
      coordinates: { lat: 7.078, lng: 125.615 },
      capacity: 200
    },
    ticketTypes: [
      {
        id: 'free',
        name: 'Free Admission',
        price: 0,
        description: 'Free for all attendees',
        available: 200,
        sold: 45
      }
    ],
    tags: ['Google I/O', 'Community', 'Networking', 'AI', 'Machine Learning'],
    category: 'conference',
    status: 'published',
    maxAttendees: 200,
    currentAttendees: 45,
    isPublished: true,
    registrationDeadline: Timestamp.fromDate(new Date('2025-02-13T23:59:59Z')),
    requirements: ['Bring your laptop', 'Valid ID for registration'],
    createdAt: Timestamp.fromDate(new Date('2024-11-15')),
    updatedAt: Timestamp.now()
  },
  {
    id: 'event-003',
    title: 'Node.js Backend Development Bootcamp',
    description: 'A comprehensive 3-day bootcamp covering Node.js backend development from basics to advanced topics. Learn to build RESTful APIs, work with databases, implement authentication, and deploy to cloud platforms.',
    shortDescription: 'Intensive 3-day Node.js backend development bootcamp.',
    imageUrl: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800',
    organizer: {
      uid: 'organizer-002',
      name: 'Carlos Rodriguez',
      email: 'organizer.two@example.test'
    },
    speakers: [
      {
        id: 'speaker-004',
        name: 'Carlos Rodriguez',
        title: 'Full-Stack Developer',
        bio: 'Node.js expert and cloud architect',
        imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'
      }
    ],
    startDate: Timestamp.fromDate(new Date('2025-03-10T09:00:00Z')),
    endDate: Timestamp.fromDate(new Date('2025-03-12T17:00:00Z')),
    timezone: 'Asia/Manila',
    venue: {
      type: 'hybrid',
      name: 'DevSpace Coworking',
      address: '456 Innovation Blvd, Davao City',
      city: 'Davao City',
      onlineLink: 'https://meet.google.com/abc-defg-hij',
      capacity: 30
    },
    ticketTypes: [
      {
        id: 'student',
        name: 'Student Price',
        price: 1500,
        description: 'Special price for students (ID required)',
        available: 10,
        sold: 7
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 3000,
        description: 'For working professionals',
        available: 20,
        sold: 12
      }
    ],
    tags: ['Node.js', 'Backend', 'API', 'Database', 'Cloud'],
    category: 'workshop',
    status: 'published',
    maxAttendees: 30,
    currentAttendees: 19,
    isPublished: true,
    registrationDeadline: Timestamp.fromDate(new Date('2025-03-08T23:59:59Z')),
    requirements: ['Laptop with Node.js installed', 'Basic programming knowledge', 'GitHub account'],
    createdAt: Timestamp.fromDate(new Date('2024-12-20')),
    updatedAt: Timestamp.now()
  },
  {
    id: 'event-004',
    title: 'Mobile App Development with Flutter',
    description: 'Learn to build beautiful, native mobile apps for both iOS and Android using Flutter. This workshop covers UI design, state management, API integration, and publishing to app stores.',
    shortDescription: 'Build mobile apps with Flutter for iOS and Android.',
    organizer: {
      uid: 'organizer-001',
      name: 'Maria Santos',
      email: 'organizer.one@example.test'
    },
    speakers: [
      {
        id: 'speaker-005',
        name: 'Alex Mobile',
        title: 'Mobile Development Lead',
        bio: 'Flutter expert with 50+ published apps',
        imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300'
      }
    ],
    startDate: Timestamp.fromDate(new Date('2025-04-05T09:00:00Z')),
    endDate: Timestamp.fromDate(new Date('2025-04-05T17:00:00Z')),
    timezone: 'Asia/Manila',
    venue: {
      type: 'online',
      onlineLink: 'https://meet.google.com/flutter-workshop',
      capacity: 100
    },
    ticketTypes: [
      {
        id: 'free',
        name: 'Free Online',
        price: 0,
        description: 'Free online workshop',
        available: 100,
        sold: 15
      }
    ],
    tags: ['Flutter', 'Mobile', 'iOS', 'Android', 'Dart'],
    category: 'workshop',
    status: 'draft',
    maxAttendees: 100,
    currentAttendees: 15,
    isPublished: false,
    registrationDeadline: Timestamp.fromDate(new Date('2025-04-03T23:59:59Z')),
    requirements: ['Laptop with Flutter SDK', 'Android Studio or VS Code', 'Basic programming knowledge'],
    createdAt: Timestamp.fromDate(new Date('2025-01-05')),
    updatedAt: Timestamp.now()
  },
  {
    id: 'event-005',
    title: 'AI & Machine Learning Workshop: Building Smart Applications',
    description: 'Dive into the exciting world of AI and Machine Learning! This comprehensive workshop covers fundamental ML concepts, practical implementation with Python and TensorFlow, and building intelligent applications. Perfect for developers looking to integrate AI into their projects. We\'ll explore supervised learning, neural networks, and deploy a real ML model.',
    shortDescription: 'Learn AI/ML fundamentals and build intelligent applications with Python and TensorFlow.',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
    organizer: {
      uid: 'admin-001',
      name: 'John Admin',
      email: 'admin@example.test'
    },
    speakers: [
      {
        id: 'speaker-006',
        name: 'Dr. Sarah Chen',
        title: 'AI Research Scientist',
        company: 'Google Research',
        bio: 'Leading AI researcher with 10+ years experience in machine learning and neural networks. Published 50+ papers in top-tier conferences.',
        photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300',
        socialLinks: {
          linkedin: 'https://linkedin.com/in/drsarahchen',
          github: 'https://github.com/sarahchen',
          twitter: 'https://twitter.com/drsarahchen'
        },
        topics: ['Machine Learning', 'Neural Networks', 'TensorFlow', 'AI Ethics']
      },
      {
        id: 'speaker-007',
        name: 'Mark Thompson',
        title: 'Senior ML Engineer',
        company: 'Microsoft Azure AI',
        bio: 'Experienced ML engineer specializing in production AI systems and MLOps. Built ML pipelines serving millions of users.',
        photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300',
        socialLinks: {
          linkedin: 'https://linkedin.com/in/markthompson',
          github: 'https://github.com/markthompson'
        },
        topics: ['MLOps', 'Production ML', 'Azure AI', 'Deployment']
      }
    ],
    startDate: Timestamp.fromDate(new Date('2024-12-15T09:00:00Z')),
    endDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    timezone: 'Asia/Manila',
    venue: {
      type: 'hybrid',
      name: 'Davao Innovation Hub',
      address: '789 Innovation Drive, Davao City',
      city: 'Davao City',
      coordinates: { lat: 7.081, lng: 125.618 },
      capacity: 80,
      onlineDetails: {
        platform: 'Google Meet',
        meetingUrl: 'https://meet.google.com/ai-ml-workshop',
        meetingId: 'ai-ml-workshop-2024',
        instructions: 'Join link will be sent 30 minutes before the event'
      }
    },
    ticketTypes: [
      {
        id: 'student-discount',
        name: 'Student',
        price: 800,
        currency: 'PHP',
        description: 'Special price for students with valid ID',
        maxQuantity: 20,
        currentSold: 12,
        isActive: true,
        benefits: ['Workshop materials', 'Certificate', 'Lunch included', 'Student networking session'],
        sortOrder: 1
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 1500,
        currency: 'PHP',
        description: 'For working professionals and developers',
        maxQuantity: 50,
        currentSold: 38,
        isActive: true,
        benefits: ['Workshop materials', 'Certificate', 'Lunch included', 'Professional networking', 'Access to ML resources'],
        sortOrder: 2
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 2500,
        currency: 'PHP',
        description: 'Premium experience with additional perks',
        maxQuantity: 10,
        currentSold: 8,
        isActive: true,
        benefits: ['All Professional benefits', '1-on-1 session with speakers', 'Premium swag kit', 'Follow-up consultation'],
        sortOrder: 3
      }
    ],
    promoCodes: [
      {
        id: 'early-bird-ai',
        code: 'EARLYAI2024',
        name: 'Early Bird AI',
        description: '20% discount for early registrations',
        discountType: 'percentage',
        discountValue: 20,
        maxUses: 25,
        currentUses: 18,
        isActive: true,
        validFrom: Timestamp.fromDate(new Date('2024-11-01')),
        validUntil: Timestamp.fromDate(new Date('2024-12-01')),
        createdBy: 'admin-001',
        createdAt: Timestamp.fromDate(new Date('2024-11-01')),
        updatedAt: Timestamp.now()
      }
    ],
    paymentConfigs: [
      {
        id: 'gcash-config',
        name: 'GCash Payment',
        bankDetails: {
          bankName: 'GCash',
          accountName: 'GDG Davao',
          accountNumber: '00000000000'
        },
        instructions: 'Use the emulator-only payment fixture. Never use this value for real payments.',
        requiresProof: true,
        requiresTransactionId: true,
        isActive: true
      }
    ],
    tags: ['AI', 'Machine Learning', 'TensorFlow', 'Python', 'Neural Networks', 'Data Science'],
    category: 'workshop',
    status: 'completed',
    maxAttendees: 80,
    currentAttendees: 58,
    isPublished: true,
    registrationDeadline: Timestamp.fromDate(new Date('2024-12-13T23:59:59Z')),
    requirements: [
      'Laptop with Python 3.8+ installed',
      'Basic programming knowledge (Python preferred)',
      'Jupyter Notebook or Google Colab access',
      'GitHub account for code repositories',
      'Enthusiasm for learning AI/ML!'
    ],
    createdAt: Timestamp.fromDate(new Date('2024-10-15')),
    updatedAt: Timestamp.now()
  }
];

const generateSampleRegistrations = () => [
  // Registrations for React Workshop (event-001)
  {
    id: 'reg-001',
    eventId: 'event-001',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Alice Developer',
      email: 'alice.developer@email.com',
      phoneNumber: '+15550100010',
      organization: 'Tech Startup Inc'
    },
    ticketTypeId: 'early-bird',
    quantity: 1,
    originalAmount: 500,
    discountAmount: 0,
    totalAmount: 500,
    currency: 'PHP',
    paymentStatus: 'paid',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-001-ALICE',
    registrationDate: Timestamp.fromDate(new Date('2024-12-15')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'early-bird',
      originalPrice: 500,
      currentPrice: 500,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  {
    id: 'reg-002',
    eventId: 'event-001',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Bob Student',
      email: 'bob.student@university.edu',
      phoneNumber: '+15550100011',
      organization: 'University of the Philippines'
    },
    ticketTypeId: 'regular',
    quantity: 1,
    originalAmount: 750,
    discountAmount: 0,
    totalAmount: 750,
    currency: 'PHP',
    paymentStatus: 'paid',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-002-BOB',
    registrationDate: Timestamp.fromDate(new Date('2024-12-20')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'regular',
      originalPrice: 750,
      currentPrice: 750,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  // Registrations for Google I/O Extended (event-002)
  {
    id: 'reg-003',
    eventId: 'event-002',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Charlie AI',
      email: 'charlie.ai@tech.com',
      phoneNumber: '+15550100012',
      organization: 'AI Solutions Corp'
    },
    ticketTypeId: 'free',
    quantity: 1,
    originalAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    currency: 'PHP',
    paymentStatus: 'paid',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-003-CHARLIE',
    registrationDate: Timestamp.fromDate(new Date('2025-01-10')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'free',
      originalPrice: 0,
      currentPrice: 0,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  // Registrations for Node.js Bootcamp (event-003)
  {
    id: 'reg-004',
    eventId: 'event-003',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Diana Backend',
      email: 'diana.backend@startup.io',
      phoneNumber: '+15550100013',
      organization: 'DevStartup'
    },
    ticketTypeId: 'professional',
    quantity: 1,
    originalAmount: 3000,
    discountAmount: 0,
    totalAmount: 3000,
    currency: 'PHP',
    paymentStatus: 'paid',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-004-DIANA',
    registrationDate: Timestamp.fromDate(new Date('2025-01-15')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'professional',
      originalPrice: 3000,
      currentPrice: 3000,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  // PENDING PAYMENT REGISTRATIONS - These need verification
  {
    id: 'reg-005',
    eventId: 'event-001',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Emma Designer',
      email: 'emma.designer@creative.com',
      phoneNumber: '+15550100014',
      organization: 'Creative Studio'
    },
    ticketTypeId: 'early-bird',
    quantity: 1,
    originalAmount: 500,
    discountAmount: 0,
    totalAmount: 500,
    currency: 'PHP',
    paymentStatus: 'pending',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-005-EMMA',
    registrationDate: Timestamp.fromDate(new Date('2025-01-02')),
    updatedAt: Timestamp.now(),
    paymentProof: {
      id: 'proof-005',
      registrationId: 'reg-005',
      proofImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      transactionId: 'GCash-20250102-001234',
      submittedAt: Timestamp.fromDate(new Date('2025-01-02T14:30:00Z')),
      verificationStatus: 'pending',
      notes: 'Payment via GCash - Screenshot attached'
    },
    pricing: {
      ticketTypeId: 'early-bird',
      originalPrice: 500,
      currentPrice: 500,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  {
    id: 'reg-006',
    eventId: 'event-001',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Frank Mobile',
      email: 'frank.mobile@apps.dev',
      phoneNumber: '+15550100015',
      organization: 'Mobile Solutions Inc'
    },
    ticketTypeId: 'regular',
    quantity: 1,
    originalAmount: 750,
    discountAmount: 0,
    totalAmount: 750,
    currency: 'PHP',
    paymentStatus: 'pending',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-006-FRANK',
    registrationDate: Timestamp.fromDate(new Date('2025-01-03')),
    updatedAt: Timestamp.now(),
    paymentProof: {
      id: 'proof-006',
      registrationId: 'reg-006',
      proofImageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400',
      transactionId: 'Maya-20250103-567890',
      submittedAt: Timestamp.fromDate(new Date('2025-01-03T09:15:00Z')),
      verificationStatus: 'pending',
      notes: 'Paid through Maya wallet'
    },
    pricing: {
      ticketTypeId: 'regular',
      originalPrice: 750,
      currentPrice: 750,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  {
    id: 'reg-007',
    eventId: 'event-003',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Grace Fullstack',
      email: 'grace.fullstack@webdev.co',
      phoneNumber: '+15550100016',
      organization: 'Web Development Co'
    },
    ticketTypeId: 'professional',
    quantity: 1,
    originalAmount: 3000,
    discountAmount: 0,
    totalAmount: 3000,
    currency: 'PHP',
    paymentStatus: 'pending',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-007-GRACE',
    registrationDate: Timestamp.fromDate(new Date('2025-01-04')),
    updatedAt: Timestamp.now(),
    paymentProof: {
      id: 'proof-007',
      registrationId: 'reg-007',
      proofImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      transactionId: 'BPI-20250104-112233',
      submittedAt: Timestamp.fromDate(new Date('2025-01-04T16:45:00Z')),
      verificationStatus: 'pending',
      notes: 'Bank transfer - BPI Online Banking'
    },
    pricing: {
      ticketTypeId: 'professional',
      originalPrice: 3000,
      currentPrice: 3000,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  {
    id: 'reg-008',
    eventId: 'event-003',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Henry Student',
      email: 'henry.student@college.edu',
      phoneNumber: '+15550100017',
      organization: 'Davao College of Technology'
    },
    ticketTypeId: 'student',
    quantity: 1,
    originalAmount: 1500,
    discountAmount: 0,
    totalAmount: 1500,
    currency: 'PHP',
    paymentStatus: 'pending',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-008-HENRY',
    registrationDate: Timestamp.fromDate(new Date('2025-01-05')),
    updatedAt: Timestamp.now(),
    paymentProof: {
      id: 'proof-008',
      registrationId: 'reg-008',
      proofImageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400',
      transactionId: 'GCash-20250105-445566',
      submittedAt: Timestamp.fromDate(new Date('2025-01-05T11:20:00Z')),
      verificationStatus: 'pending',
      notes: 'Student payment via GCash - ID verification attached'
    },
    pricing: {
      ticketTypeId: 'student',
      originalPrice: 1500,
      currentPrice: 1500,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  {
    id: 'reg-009',
    eventId: 'event-001',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Ivy Marketing',
      email: 'ivy.marketing@digital.agency',
      phoneNumber: '+15550100018',
      organization: 'Digital Marketing Agency'
    },
    ticketTypeId: 'early-bird',
    quantity: 1,
    originalAmount: 500,
    discountAmount: 0,
    totalAmount: 500,
    currency: 'PHP',
    paymentStatus: 'pending',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-009-IVY',
    registrationDate: Timestamp.fromDate(new Date('2025-01-06')),
    updatedAt: Timestamp.now(),
    paymentProof: {
      id: 'proof-009',
      registrationId: 'reg-009',
      proofImageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      transactionId: 'PayMaya-20250106-778899',
      submittedAt: Timestamp.fromDate(new Date('2025-01-06T13:10:00Z')),
      verificationStatus: 'pending',
      notes: 'PayMaya transaction - Receipt screenshot'
    },
    pricing: {
      ticketTypeId: 'early-bird',
      originalPrice: 500,
      currentPrice: 500,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  {
    id: 'reg-010',
    eventId: 'event-003',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Jack Entrepreneur',
      email: 'jack.entrepreneur@startup.ph',
      phoneNumber: '+15550100019',
      organization: 'TechStartup Philippines'
    },
    ticketTypeId: 'professional',
    quantity: 1,
    originalAmount: 3000,
    discountAmount: 0,
    totalAmount: 3000,
    currency: 'PHP',
    paymentStatus: 'pending',
    attendanceStatus: 'registered',
    feedbackSubmitted: false,
    certificateIssued: false,
    qrCode: 'QR-REG-010-JACK',
    registrationDate: Timestamp.fromDate(new Date('2025-01-07')),
    updatedAt: Timestamp.now(),
    paymentProof: {
      id: 'proof-010',
      registrationId: 'reg-010',
      proofImageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400',
      transactionId: 'UnionBank-20250107-334455',
      submittedAt: Timestamp.fromDate(new Date('2025-01-07T10:30:00Z')),
      verificationStatus: 'pending',
      notes: 'UnionBank online transfer'
    },
    pricing: {
      ticketTypeId: 'professional',
      originalPrice: 3000,
      currentPrice: 3000,
      discountAmount: 0,
      isEarlyBird: false
    }
  },
  // Approved Attendees for AI/ML Workshop (event-005) - All PAID status
  {
    id: 'reg-011',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Dr. Lisa Wang',
      email: 'lisa.wang@techcorp.com',
      phoneNumber: '+15550100020',
      organization: 'TechCorp Solutions',
      dietaryRestrictions: 'Vegetarian',
      tshirtSize: 'M',
      emergencyContact: {
        name: 'Michael Wang',
        phone: '+15550100021'
      }
    },
    ticketTypeId: 'premium',
    quantity: 1,
    originalAmount: 2500,
    discountAmount: 0,
    totalAmount: 2500,
    currency: 'PHP',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-011',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241201-001',
      paidAt: Timestamp.fromDate(new Date('2024-12-01T14:30:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T08:45:00Z')),
    feedbackSubmitted: true,
    certificateIssued: true,
    certificateId: 'cert-ai-011',
    qrCode: 'QR-REG-011-LISA',
    registrationDate: Timestamp.fromDate(new Date('2024-11-20')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'premium',
      originalPrice: 2500,
      currentPrice: 2500,
      discountAmount: 0
    }
  },
  {
    id: 'reg-012',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'James Rodriguez',
      email: 'james.rodriguez@startup.io',
      phoneNumber: '+15550100022',
      organization: 'AI Startup Philippines',
      dietaryRestrictions: 'None',
      tshirtSize: 'L'
    },
    ticketTypeId: 'professional',
    quantity: 1,
    originalAmount: 1500,
    discountAmount: 300, // 20% early bird discount
    totalAmount: 1200,
    currency: 'PHP',
    promoCode: 'EARLYAI2024',
    promoCodeId: 'early-bird-ai',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-012',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241125-002',
      paidAt: Timestamp.fromDate(new Date('2024-11-25T10:15:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T09:10:00Z')),
    feedbackSubmitted: true,
    certificateIssued: true,
    certificateId: 'cert-ai-012',
    qrCode: 'QR-REG-012-JAMES',
    registrationDate: Timestamp.fromDate(new Date('2024-11-18')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'professional',
      originalPrice: 1500,
      currentPrice: 1200,
      discountAmount: 300,
      discountType: 'promo_code',
      promoCode: 'EARLYAI2024',
      promoCodeId: 'early-bird-ai'
    }
  },
  {
    id: 'reg-013',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Maria Gonzales',
      email: 'maria.gonzales@university.edu.ph',
      phoneNumber: '+15550100023',
      organization: 'University of the Philippines - Mindanao',
      dietaryRestrictions: 'Halal',
      tshirtSize: 'S',
      emergencyContact: {
        name: 'Ana Gonzales',
        phone: '+15550100024'
      }
    },
    ticketTypeId: 'student-discount',
    quantity: 1,
    originalAmount: 800,
    discountAmount: 160, // 20% early bird discount
    totalAmount: 640,
    currency: 'PHP',
    promoCode: 'EARLYAI2024',
    promoCodeId: 'early-bird-ai',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-013',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241122-003',
      paidAt: Timestamp.fromDate(new Date('2024-11-22T16:20:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T08:55:00Z')),
    feedbackSubmitted: true,
    certificateIssued: true,
    certificateId: 'cert-ai-013',
    qrCode: 'QR-REG-013-MARIA',
    registrationDate: Timestamp.fromDate(new Date('2024-11-15')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'student-discount',
      originalPrice: 800,
      currentPrice: 640,
      discountAmount: 160,
      discountType: 'promo_code',
      promoCode: 'EARLYAI2024',
      promoCodeId: 'early-bird-ai'
    }
  },
  {
    id: 'reg-014',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Kevin Tan',
      email: 'kevin.tan@devstudio.ph',
      phoneNumber: '+15550100025',
      organization: 'DevStudio Philippines',
      dietaryRestrictions: 'None',
      tshirtSize: 'XL'
    },
    ticketTypeId: 'professional',
    quantity: 1,
    originalAmount: 1500,
    discountAmount: 0,
    totalAmount: 1500,
    currency: 'PHP',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-014',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241205-004',
      paidAt: Timestamp.fromDate(new Date('2024-12-05T11:45:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T09:05:00Z')),
    feedbackSubmitted: true,
    certificateIssued: true,
    certificateId: 'cert-ai-014',
    qrCode: 'QR-REG-014-KEVIN',
    registrationDate: Timestamp.fromDate(new Date('2024-12-03')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'professional',
      originalPrice: 1500,
      currentPrice: 1500,
      discountAmount: 0
    }
  },
  {
    id: 'reg-015',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Sarah Kim',
      email: 'sarah.kim@dataanalytics.com',
      phoneNumber: '+15550100026',
      organization: 'Data Analytics Solutions',
      dietaryRestrictions: 'Vegan',
      tshirtSize: 'M',
      emergencyContact: {
        name: 'John Kim',
        phone: '+15550100027'
      }
    },
    ticketTypeId: 'premium',
    quantity: 1,
    originalAmount: 2500,
    discountAmount: 500, // 20% early bird discount
    totalAmount: 2000,
    currency: 'PHP',
    promoCode: 'EARLYAI2024',
    promoCodeId: 'early-bird-ai',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-015',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241120-005',
      paidAt: Timestamp.fromDate(new Date('2024-11-20T09:30:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T08:40:00Z')),
    feedbackSubmitted: true,
    certificateIssued: true,
    certificateId: 'cert-ai-015',
    qrCode: 'QR-REG-015-SARAH',
    registrationDate: Timestamp.fromDate(new Date('2024-11-18')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'premium',
      originalPrice: 2500,
      currentPrice: 2000,
      discountAmount: 500,
      discountType: 'promo_code',
      promoCode: 'EARLYAI2024',
      promoCodeId: 'early-bird-ai'
    }
  },
  {
    id: 'reg-016',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Michael Chen',
      email: 'michael.chen@fintech.ph',
      phoneNumber: '+15550100028',
      organization: 'FinTech Innovations',
      dietaryRestrictions: 'None',
      tshirtSize: 'L'
    },
    ticketTypeId: 'professional',
    quantity: 1,
    originalAmount: 1500,
    discountAmount: 300, // 20% early bird discount
    totalAmount: 1200,
    currency: 'PHP',
    promoCode: 'EARLYAI2024',
    promoCodeId: 'early-bird-ai',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-016',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241128-006',
      paidAt: Timestamp.fromDate(new Date('2024-11-28T15:10:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T09:15:00Z')),
    feedbackSubmitted: true,
    certificateIssued: false, // Certificate not yet issued
    qrCode: 'QR-REG-016-MICHAEL',
    registrationDate: Timestamp.fromDate(new Date('2024-11-26')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'professional',
      originalPrice: 1500,
      currentPrice: 1200,
      discountAmount: 300,
      discountType: 'promo_code',
      promoCode: 'EARLYAI2024',
      promoCodeId: 'early-bird-ai'
    }
  },
  {
    id: 'reg-017',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'Anna Santos',
      email: 'anna.santos@college.edu.ph',
      phoneNumber: '+15550100029',
      organization: 'Ateneo de Davao University',
      dietaryRestrictions: 'Lactose intolerant',
      tshirtSize: 'S',
      emergencyContact: {
        name: 'Pedro Santos',
        phone: '+15550100030'
      }
    },
    ticketTypeId: 'student-discount',
    quantity: 1,
    originalAmount: 800,
    discountAmount: 0,
    totalAmount: 800,
    currency: 'PHP',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-017',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241210-007',
      paidAt: Timestamp.fromDate(new Date('2024-12-10T13:25:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T09:00:00Z')),
    feedbackSubmitted: false, // Feedback not submitted yet
    certificateIssued: false,
    qrCode: 'QR-REG-017-ANNA',
    registrationDate: Timestamp.fromDate(new Date('2024-12-08')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'student-discount',
      originalPrice: 800,
      currentPrice: 800,
      discountAmount: 0
    }
  },
  {
    id: 'reg-018',
    eventId: 'event-005',
    userId: '', // Anonymous registration
    userDetails: {
      name: 'David Park',
      email: 'david.park@mlstudio.ai',
      phoneNumber: '+15550100031',
      organization: 'ML Studio AI',
      dietaryRestrictions: 'Gluten-free',
      tshirtSize: 'M'
    },
    ticketTypeId: 'premium',
    quantity: 1,
    originalAmount: 2500,
    discountAmount: 0,
    totalAmount: 2500,
    currency: 'PHP',
    paymentStatus: 'paid',
    paymentDetails: {
      paymentId: 'pay-ai-018',
      paymentMethod: 'gcash',
      transactionId: 'GCash-AI-20241212-008',
      paidAt: Timestamp.fromDate(new Date('2024-12-12T10:40:00Z'))
    },
    attendanceStatus: 'checked-in',
    checkInTime: Timestamp.fromDate(new Date('2024-12-15T08:50:00Z')),
    feedbackSubmitted: true,
    certificateIssued: true,
    certificateId: 'cert-ai-018',
    qrCode: 'QR-REG-018-DAVID',
    registrationDate: Timestamp.fromDate(new Date('2024-12-10')),
    updatedAt: Timestamp.now(),
    pricing: {
      ticketTypeId: 'premium',
      originalPrice: 2500,
      currentPrice: 2500,
      discountAmount: 0
    }
  }
];

const generateSampleFeedback = () => [
  {
    id: 'feedback-001',
    eventId: 'event-001',
    userId: 'reg-001',
    userEmail: 'alice.developer@email.com',
    userName: 'Alice Developer',
    overallRating: 5,
    contentRating: 5,
    organizationRating: 4,
    venueRating: 4,
    speakerRatings: [
      {
        speakerId: 'speaker-001',
        rating: 5,
        comments: 'Excellent presentation, very clear explanations'
      }
    ],
    responses: {
      'most-valuable': 'Hands-on coding exercises',
      'improvement-suggestions': 'More time for Q&A',
      'difficulty-level': 'Just right',
      'would-attend-again': 'Yes'
    },
    comments: 'Fantastic workshop! Really enjoyed the hands-on approach and practical examples.',
    suggestions: 'Would love a follow-up workshop on advanced React patterns.',
    wouldRecommend: true,
    futureTopics: ['Redux', 'React Native', 'Testing'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-22'))
  },
  // Comprehensive Feedback for AI/ML Workshop (event-005)
  {
    id: 'feedback-ai-011',
    eventId: 'event-005',
    userId: 'reg-011',
    registrationId: 'reg-011',
    userEmail: 'lisa.wang@techcorp.com',
    userName: 'Dr. Lisa Wang',
    overallRating: 5,
    contentRating: 5,
    organizationRating: 5,
    venueRating: 4,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 5,
        comments: 'Dr. Chen\'s explanation of neural networks was incredibly clear and comprehensive. The theoretical foundation was excellent.'
      },
      {
        speakerId: 'speaker-007',
        rating: 5,
        comments: 'Mark\'s practical insights on MLOps and production deployment were invaluable. Real-world examples were very helpful.'
      }
    ],
    customResponses: {
      'overall_rating': 5,
      'content_rating': 5,
      'organization_rating': 5,
      'what_liked': 'The perfect balance between theory and practice. The hands-on TensorFlow exercises were excellent, and the speakers were world-class. The hybrid format worked well.',
      'improvements': 'Perhaps a bit more time on advanced neural network architectures. Also, the lunch break could be slightly longer.',
      'recommend': 'Yes',
      'future_topics': 'Deep Learning, Computer Vision, Natural Language Processing, Reinforcement Learning'
    },
    comments: 'Outstanding workshop! As someone with a research background, I was impressed by the depth of content and quality of instruction. The combination of Dr. Chen\'s theoretical expertise and Mark\'s practical experience created a perfect learning environment. The TensorFlow exercises were well-designed and the deployment section was particularly valuable for our company projects.',
    suggestions: 'Consider adding a session on AI ethics and responsible AI development. Also, a follow-up workshop on advanced topics would be fantastic.',
    wouldRecommend: true,
    futureTopics: ['Deep Learning', 'Computer Vision', 'NLP', 'AI Ethics', 'Reinforcement Learning'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-16T10:30:00Z'))
  },
  {
    id: 'feedback-ai-012',
    eventId: 'event-005',
    userId: 'reg-012',
    registrationId: 'reg-012',
    userEmail: 'james.rodriguez@startup.io',
    userName: 'James Rodriguez',
    overallRating: 4,
    contentRating: 4,
    organizationRating: 5,
    venueRating: 4,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 4,
        comments: 'Great content but sometimes went a bit too fast for beginners like me.'
      },
      {
        speakerId: 'speaker-007',
        rating: 5,
        comments: 'Excellent practical session! The deployment examples were exactly what I needed for my startup.'
      }
    ],
    customResponses: {
      'overall_rating': 4,
      'content_rating': 4,
      'organization_rating': 5,
      'what_liked': 'The practical deployment session was amazing. Learning how to actually put ML models into production was invaluable for our startup.',
      'improvements': 'Some parts were quite advanced for beginners. Maybe have different tracks or more foundational content.',
      'recommend': 'Yes',
      'future_topics': 'Startup-focused ML, Cost-effective AI solutions, Minimal viable ML products'
    },
    comments: 'Really valuable workshop for someone building AI products in a startup environment. The production deployment session by Mark was worth the entire ticket price. Dr. Chen\'s content was excellent but sometimes above my current level.',
    suggestions: 'Consider having beginner and advanced tracks. Also, more focus on cost-effective AI solutions for startups would be great.',
    wouldRecommend: true,
    futureTopics: ['Startup AI', 'Cost-effective ML', 'MVP AI Products', 'AI for Small Teams'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-16T14:20:00Z'))
  },
  {
    id: 'feedback-ai-013',
    eventId: 'event-005',
    userId: 'reg-013',
    registrationId: 'reg-013',
    userEmail: 'maria.gonzales@university.edu.ph',
    userName: 'Maria Gonzales',
    overallRating: 5,
    contentRating: 5,
    organizationRating: 4,
    venueRating: 5,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 5,
        comments: 'As a student, Dr. Chen\'s teaching style was perfect. Very clear explanations and great examples.'
      },
      {
        speakerId: 'speaker-007',
        rating: 4,
        comments: 'Good practical insights, though some industry-specific content was over my head as a student.'
      }
    ],
    customResponses: {
      'overall_rating': 5,
      'content_rating': 5,
      'organization_rating': 4,
      'what_liked': 'The theoretical foundations were explained so clearly! As a student, I finally understand how neural networks actually work. The Python exercises were perfect.',
      'improvements': 'Maybe provide more student-focused resources and career guidance in AI/ML.',
      'recommend': 'Yes',
      'future_topics': 'AI research methods, Academic AI projects, AI career guidance'
    },
    comments: 'Absolutely loved this workshop! As a computer science student, this gave me a solid foundation in AI/ML. Dr. Chen\'s explanations were crystal clear, and I feel confident to start my own AI projects now. The student discount made it very affordable too!',
    suggestions: 'More workshops like this for students! Maybe add a session on AI research opportunities and career paths in academia vs industry.',
    wouldRecommend: true,
    futureTopics: ['AI Research', 'Academic Projects', 'Career Guidance', 'Advanced Mathematics for AI'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-16T16:45:00Z'))
  },
  {
    id: 'feedback-ai-014',
    eventId: 'event-005',
    userId: 'reg-014',
    registrationId: 'reg-014',
    userEmail: 'kevin.tan@devstudio.ph',
    userName: 'Kevin Tan',
    overallRating: 4,
    contentRating: 4,
    organizationRating: 4,
    venueRating: 3,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 4,
        comments: 'Good theoretical content, though quite dense at times.'
      },
      {
        speakerId: 'speaker-007',
        rating: 4,
        comments: 'Practical insights were valuable for our development work.'
      }
    ],
    customResponses: {
      'overall_rating': 4,
      'content_rating': 4,
      'organization_rating': 4,
      'what_liked': 'Good balance of theory and practice. The code examples were well-prepared and the GitHub repo is helpful.',
      'improvements': 'Venue WiFi was a bit slow during hands-on sessions. Also, some technical difficulties with the projector.',
      'recommend': 'Yes',
      'future_topics': 'AI for web applications, Mobile AI, Edge computing for ML'
    },
    comments: 'Solid workshop overall. Got practical knowledge I can apply in our development projects. Some technical issues with the venue setup, but the content quality made up for it.',
    suggestions: 'Better venue tech setup needed. Also, more focus on integrating AI into existing web/mobile applications would be great.',
    wouldRecommend: true,
    futureTopics: ['Web AI Integration', 'Mobile ML', 'Edge AI', 'AI APIs'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-17T09:15:00Z'))
  },
  {
    id: 'feedback-ai-015',
    eventId: 'event-005',
    userId: 'reg-015',
    registrationId: 'reg-015',
    userEmail: 'sarah.kim@dataanalytics.com',
    userName: 'Sarah Kim',
    overallRating: 5,
    contentRating: 5,
    organizationRating: 5,
    venueRating: 5,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 5,
        comments: 'Exceptional expertise and teaching ability. The neural network deep-dive was exactly what I needed.'
      },
      {
        speakerId: 'speaker-007',
        rating: 5,
        comments: 'Perfect practical complement to the theory. The MLOps pipeline examples were incredibly valuable.'
      }
    ],
    customResponses: {
      'overall_rating': 5,
      'content_rating': 5,
      'organization_rating': 5,
      'what_liked': 'Everything! The premium experience was worth every peso. The 1-on-1 session with the speakers was invaluable for my specific data analytics challenges.',
      'improvements': 'Honestly, hard to find any major issues. Maybe record the sessions for later reference?',
      'recommend': 'Yes',
      'future_topics': 'Advanced data analytics with AI, Time series forecasting, Anomaly detection'
    },
    comments: 'Exceptional workshop! The premium ticket was absolutely worth it. The 1-on-1 session helped me solve specific challenges in my data analytics work. Both speakers were world-class, and the organization was flawless. This is exactly the kind of high-quality tech education we need more of in the Philippines.',
    suggestions: 'Please do more premium workshops like this! Consider recording sessions for premium attendees. Also, a follow-up advanced workshop would be fantastic.',
    wouldRecommend: true,
    futureTopics: ['Advanced Analytics', 'Time Series ML', 'Anomaly Detection', 'Predictive Analytics'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-15T20:30:00Z'))
  },
  {
    id: 'feedback-ai-016',
    eventId: 'event-005',
    userId: 'reg-016',
    registrationId: 'reg-016',
    userEmail: 'michael.chen@fintech.ph',
    userName: 'Michael Chen',
    overallRating: 4,
    contentRating: 5,
    organizationRating: 4,
    venueRating: 4,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 5,
        comments: 'Outstanding theoretical foundation. The math behind neural networks was well explained.'
      },
      {
        speakerId: 'speaker-007',
        rating: 4,
        comments: 'Good practical insights, especially relevant for fintech applications.'
      }
    ],
    customResponses: {
      'overall_rating': 4,
      'content_rating': 5,
      'organization_rating': 4,
      'what_liked': 'The content quality was exceptional. Really appreciated the mathematical rigor while keeping it accessible.',
      'improvements': 'Registration process was a bit confusing. Also, more fintech-specific examples would have been great.',
      'recommend': 'Yes',
      'future_topics': 'AI in fintech, Fraud detection, Risk assessment with ML, Algorithmic trading'
    },
    comments: 'High-quality content and excellent speakers. The theoretical foundation was solid and the practical applications were relevant. Would love to see more industry-specific workshops.',
    suggestions: 'More fintech-focused AI workshops would be amazing. Also, streamline the registration process.',
    wouldRecommend: true,
    futureTopics: ['Fintech AI', 'Fraud Detection', 'Risk Assessment', 'Algorithmic Trading'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-18T11:00:00Z'))
  },
  {
    id: 'feedback-ai-018',
    eventId: 'event-005',
    userId: 'reg-018',
    registrationId: 'reg-018',
    userEmail: 'david.park@mlstudio.ai',
    userName: 'David Park',
    overallRating: 5,
    contentRating: 5,
    organizationRating: 5,
    venueRating: 4,
    speakerRatings: [
      {
        speakerId: 'speaker-006',
        rating: 5,
        comments: 'World-class expertise. The research insights were particularly valuable for our AI studio work.'
      },
      {
        speakerId: 'speaker-007',
        rating: 5,
        comments: 'Excellent practical knowledge. The production ML pipeline discussion was spot-on.'
      }
    ],
    customResponses: {
      'overall_rating': 5,
      'content_rating': 5,
      'organization_rating': 5,
      'what_liked': 'The depth of knowledge from both speakers was incredible. Perfect for someone already working in the AI space who wanted to level up.',
      'improvements': 'Maybe a longer session on cutting-edge research trends. The premium swag kit was nice touch!',
      'recommend': 'Yes',
      'future_topics': 'Cutting-edge AI research, Generative AI, Large Language Models, AI safety'
    },
    comments: 'Outstanding workshop for AI professionals! Both speakers brought incredible depth and the content was perfectly pitched for practitioners. The premium experience was excellent and the networking opportunities were valuable.',
    suggestions: 'More advanced workshops like this! Consider a series focusing on cutting-edge topics like LLMs, generative AI, and AI safety.',
    wouldRecommend: true,
    futureTopics: ['Generative AI', 'Large Language Models', 'AI Safety', 'Cutting-edge Research'],
    submittedAt: Timestamp.fromDate(new Date('2024-12-16T18:45:00Z'))
  }
];

const generateSampleCertificates = () => [
  {
    id: 'cert-001',
    eventId: 'event-001',
    attendeeEmail: 'alice.developer@email.com',
    attendeeName: 'Alice Developer',
    certificateUrl: 'https://certificates.gdgdavao.org/cert-001.pdf',
    verificationCode: 'GDG-REACT-2025-001',
    issuedAt: Timestamp.fromDate(new Date('2024-12-22')),
    templateUsed: 'workshop-completion',
    eventTitle: 'React Workshop: Building Modern Web Apps',
    organizerName: 'GDG Davao',
    completionDate: Timestamp.fromDate(new Date('2024-12-20'))
  },
  // Certificates for AI/ML Workshop (event-005)
  {
    id: 'cert-ai-011',
    credentialId: 'GDG-AI-ML-2024-011',
    eventId: 'event-005',
    userId: 'reg-011',
    registrationId: 'reg-011',
    recipientName: 'Dr. Lisa Wang',
    eventTitle: 'AI & Machine Learning Workshop: Building Smart Applications',
    eventDate: 'December 15, 2024',
    completionDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    certificateUrl: 'https://certificates.gdgdavao.org/ai-ml-2024/cert-ai-011.pdf',
    verificationUrl: 'https://gdgdavao.org/verify/GDG-AI-ML-2024-011',
    isVerified: true,
    templateId: 'ai-workshop-premium',
    metadata: {
      eventDuration: '8 hours',
      skills: ['Machine Learning', 'TensorFlow', 'Neural Networks', 'MLOps'],
      topics: ['AI Fundamentals', 'Neural Networks', 'TensorFlow', 'Production ML']
    },
    issuedAt: Timestamp.fromDate(new Date('2024-12-16T09:00:00Z')),
    downloadCount: 3,
    verificationCount: 1
  },
  {
    id: 'cert-ai-012',
    credentialId: 'GDG-AI-ML-2024-012',
    eventId: 'event-005',
    userId: 'reg-012',
    registrationId: 'reg-012',
    recipientName: 'James Rodriguez',
    eventTitle: 'AI & Machine Learning Workshop: Building Smart Applications',
    eventDate: 'December 15, 2024',
    completionDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    certificateUrl: 'https://certificates.gdgdavao.org/ai-ml-2024/cert-ai-012.pdf',
    verificationUrl: 'https://gdgdavao.org/verify/GDG-AI-ML-2024-012',
    isVerified: true,
    templateId: 'ai-workshop-professional',
    metadata: {
      eventDuration: '8 hours',
      skills: ['Machine Learning', 'TensorFlow', 'Production ML', 'Startup AI'],
      topics: ['AI Fundamentals', 'Neural Networks', 'TensorFlow', 'Production ML']
    },
    issuedAt: Timestamp.fromDate(new Date('2024-12-16T09:00:00Z')),
    downloadCount: 2,
    verificationCount: 0
  },
  {
    id: 'cert-ai-013',
    credentialId: 'GDG-AI-ML-2024-013',
    eventId: 'event-005',
    userId: 'reg-013',
    registrationId: 'reg-013',
    recipientName: 'Maria Gonzales',
    eventTitle: 'AI & Machine Learning Workshop: Building Smart Applications',
    eventDate: 'December 15, 2024',
    completionDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    certificateUrl: 'https://certificates.gdgdavao.org/ai-ml-2024/cert-ai-013.pdf',
    verificationUrl: 'https://gdgdavao.org/verify/GDG-AI-ML-2024-013',
    isVerified: true,
    templateId: 'ai-workshop-student',
    metadata: {
      eventDuration: '8 hours',
      skills: ['Machine Learning', 'TensorFlow', 'Python', 'Neural Networks'],
      topics: ['AI Fundamentals', 'Neural Networks', 'TensorFlow', 'Python for AI']
    },
    issuedAt: Timestamp.fromDate(new Date('2024-12-16T09:00:00Z')),
    downloadCount: 1,
    verificationCount: 2
  },
  {
    id: 'cert-ai-014',
    credentialId: 'GDG-AI-ML-2024-014',
    eventId: 'event-005',
    userId: 'reg-014',
    registrationId: 'reg-014',
    recipientName: 'Kevin Tan',
    eventTitle: 'AI & Machine Learning Workshop: Building Smart Applications',
    eventDate: 'December 15, 2024',
    completionDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    certificateUrl: 'https://certificates.gdgdavao.org/ai-ml-2024/cert-ai-014.pdf',
    verificationUrl: 'https://gdgdavao.org/verify/GDG-AI-ML-2024-014',
    isVerified: true,
    templateId: 'ai-workshop-professional',
    metadata: {
      eventDuration: '8 hours',
      skills: ['Machine Learning', 'TensorFlow', 'Web AI Integration'],
      topics: ['AI Fundamentals', 'Neural Networks', 'TensorFlow', 'AI APIs']
    },
    issuedAt: Timestamp.fromDate(new Date('2024-12-16T09:00:00Z')),
    downloadCount: 1,
    verificationCount: 0
  },
  {
    id: 'cert-ai-015',
    credentialId: 'GDG-AI-ML-2024-015',
    eventId: 'event-005',
    userId: 'reg-015',
    registrationId: 'reg-015',
    recipientName: 'Sarah Kim',
    eventTitle: 'AI & Machine Learning Workshop: Building Smart Applications',
    eventDate: 'December 15, 2024',
    completionDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    certificateUrl: 'https://certificates.gdgdavao.org/ai-ml-2024/cert-ai-015.pdf',
    verificationUrl: 'https://gdgdavao.org/verify/GDG-AI-ML-2024-015',
    isVerified: true,
    templateId: 'ai-workshop-premium',
    metadata: {
      eventDuration: '8 hours',
      skills: ['Machine Learning', 'TensorFlow', 'Data Analytics', 'Advanced ML'],
      topics: ['AI Fundamentals', 'Neural Networks', 'TensorFlow', 'Advanced Analytics']
    },
    issuedAt: Timestamp.fromDate(new Date('2024-12-16T09:00:00Z')),
    downloadCount: 4,
    verificationCount: 3
  },
  {
    id: 'cert-ai-018',
    credentialId: 'GDG-AI-ML-2024-018',
    eventId: 'event-005',
    userId: 'reg-018',
    registrationId: 'reg-018',
    recipientName: 'David Park',
    eventTitle: 'AI & Machine Learning Workshop: Building Smart Applications',
    eventDate: 'December 15, 2024',
    completionDate: Timestamp.fromDate(new Date('2024-12-15T17:00:00Z')),
    certificateUrl: 'https://certificates.gdgdavao.org/ai-ml-2024/cert-ai-018.pdf',
    verificationUrl: 'https://gdgdavao.org/verify/GDG-AI-ML-2024-018',
    isVerified: true,
    templateId: 'ai-workshop-premium',
    metadata: {
      eventDuration: '8 hours',
      skills: ['Machine Learning', 'TensorFlow', 'AI Research', 'Advanced AI'],
      topics: ['AI Fundamentals', 'Neural Networks', 'TensorFlow', 'Cutting-edge AI']
    },
    issuedAt: Timestamp.fromDate(new Date('2024-12-16T09:00:00Z')),
    downloadCount: 2,
    verificationCount: 1
  }
];

const generateSystemSettings = () => [
  {
    settingKey: 'registration_enabled',
    settingValue: true,
    description: 'Global setting to enable/disable event registrations',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-001'
  },
  {
    settingKey: 'max_events_per_organizer',
    settingValue: 10,
    description: 'Maximum number of active events per organizer',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-001'
  },
  {
    settingKey: 'organization_name',
    settingValue: 'GDG Davao',
    description: 'Primary organization name',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-001'
  },
  {
    settingKey: 'contact_email',
    settingValue: 'admin@example.test',
    description: 'Primary contact email for the organization',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-001'
  }
];

// Population functions
async function populateUsers() {
  console.log('👥 Creating sample users...');
  const users = generateSampleUsers();
  
  for (const user of users) {
    // Create Firebase Auth user
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        password: seedPassword,
        emailVerified: true
      });
      console.log(`   ✅ Created Auth user: ${user.displayName} (${user.role})`);
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        console.log(`   ⚠️  Auth user already exists: ${user.displayName}`);
      } else {
        console.error(`   ❌ Failed to create Auth user ${user.displayName}:`, error.message);
      }
    }
    
    // Create Firestore user document
    await db.collection('users').doc(user.uid).set(user);
    console.log(`   ✅ Created Firestore user: ${user.displayName} (${user.role})`);
  }
  console.log(`   📊 Total users created: ${users.length}`);
}

async function populateEvents() {
  console.log('🎉 Creating sample events...');
  const events = generateSampleEvents();
  
  for (const event of events) {
    await db.collection('events').doc(event.id).set(event);
    console.log(`   ✅ Created event: ${event.title} (${event.status})`);
    
    // Create sample forms for each event
    const registrationForm = {
      type: 'registration',
      fields: [
        { id: 'firstName', type: 'text', label: 'First Name', required: true },
        { id: 'lastName', type: 'text', label: 'Last Name', required: true },
        { id: 'email', type: 'email', label: 'Email', required: true },
        { id: 'phoneNumber', type: 'tel', label: 'Phone Number', required: true },
        { id: 'organization', type: 'text', label: 'Organization', required: false },
        { id: 'experience', type: 'select', label: 'Experience Level', 
          options: ['beginner', 'intermediate', 'advanced'], required: true }
      ],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await db.collection('events').doc(event.id).collection('forms').doc('registration').set(registrationForm);
  }
  console.log(`   📊 Total events created: ${events.length}`);
}

async function populateRegistrations() {
  console.log('📝 Creating sample registrations...');
  const registrations = generateSampleRegistrations();
  
  for (const registration of registrations) {
    await db.collection('registrations').doc(registration.id).set(registration);
    console.log(`   ✅ Created registration: ${registration.userDetails.name}`);
  }
  console.log(`   📊 Total registrations created: ${registrations.length}`);
}

async function populateFeedback() {
  console.log('📋 Creating sample feedback...');
  const feedback = generateSampleFeedback();
  
  for (const item of feedback) {
    await db.collection('feedback').doc(item.id).set(item);
    console.log(`   ✅ Created feedback from: ${item.userName}`);
  }
  console.log(`   📊 Total feedback created: ${feedback.length}`);
}

async function populateCertificates() {
  console.log('🏆 Creating sample certificates...');
  const certificates = generateSampleCertificates();
  
  for (const cert of certificates) {
    await db.collection('certificates').doc(cert.id).set(cert);
    console.log(`   ✅ Created certificate for: ${cert.attendeeName}`);
  }
  console.log(`   📊 Total certificates created: ${certificates.length}`);
}

async function populateSystemSettings() {
  console.log('⚙️ Creating system settings...');
  const settings = generateSystemSettings();
  
  for (const setting of settings) {
    await db.collection('system').doc(setting.settingKey).set(setting);
    console.log(`   ✅ Created setting: ${setting.settingKey}`);
  }
  console.log(`   📊 Total settings created: ${settings.length}`);
}

async function createActivityLogs() {
  console.log('📊 Creating sample activity logs...');
  
  const logs = [
    {
      type: 'event_created',
      userId: 'organizer-001',
      eventId: 'event-001',
      description: 'Created React Workshop event',
      timestamp: Timestamp.fromDate(new Date('2024-12-01')),
      metadata: { eventTitle: 'React Workshop: Building Modern Web Apps' }
    },
    {
      type: 'user_registered',
      eventId: 'event-001',
      registrationId: 'reg-001',
      description: 'New registration for React Workshop',
      timestamp: Timestamp.fromDate(new Date('2024-12-15')),
      metadata: { attendeeName: 'Alice Developer' }
    },
    {
      type: 'event_published',
      userId: 'admin-001',
      eventId: 'event-002',
      description: 'Published Google I/O Extended event',
      timestamp: Timestamp.fromDate(new Date('2024-11-20')),
      metadata: { eventTitle: 'Google I/O Extended Davao 2025' }
    }
  ];
  
  for (let i = 0; i < logs.length; i++) {
    await db.collection('activity_logs').doc(`log-${String(i + 1).padStart(3, '0')}`).set(logs[i]);
    console.log(`   ✅ Created activity log: ${logs[i].type}`);
  }
  console.log(`   📊 Total activity logs created: ${logs.length}`);
}

// Main population function
async function populateSampleData() {
  try {
    console.log('🚀 Starting sample data population...\n');
    
    await populateUsers();
    console.log('');
    
    await populateEvents();
    console.log('');
    
    await populateRegistrations();
    console.log('');
    
    await populateFeedback();
    console.log('');
    
    await populateCertificates();
    console.log('');
    
    await populateSystemSettings();
    console.log('');
    
    await createActivityLogs();
    console.log('');
    
    console.log('🎉 Sample data population completed successfully!');
    console.log('');
    console.log('📋 What was created:');
    console.log('   • 3 Auth Users + Firestore Documents (1 admin, 2 organizers)');
    console.log('   • 5 Events (3 published, 1 completed with full data, 1 draft)');
    console.log('   • 18 Registrations across different events');
    console.log('     - 10 with paid status (confirmed attendees)');
    console.log('     - 8 with pending payment status (need verification)');
    console.log('   • 8 Feedback submissions (7 for AI/ML workshop + 1 for React)');
    console.log('   • 7 Certificates (6 for AI/ML workshop + 1 for React)');
    console.log('   • 4 System settings');
    console.log('   • 3 Activity logs');
    console.log('');
    console.log('🎯 Test Data Ready:');
    console.log('   • Login with the seeded account emails and APOHUB_SEED_PASSWORD');
    console.log('   • Browse events, view registrations, check analytics');
    console.log('   • Test event creation, editing, and management');
    console.log('   • Use Payment Verification tab to approve/reject pending payments');
    console.log('');
    console.log('💳 Payment Verification Testing:');
    console.log('   • 8 registrations need payment verification');
    console.log('   • Navigate to Attendees page → Payment Verification tab');
    console.log('   • Approve or reject pending payments');
    console.log('   • Test payment workflow integration');
    console.log('');
    console.log('🤖 Featured Event - AI/ML Workshop (event-005):');
    console.log('   • Complete event with 8 approved attendees (all paid)');
    console.log('   • 6 comprehensive feedback submissions with ratings');
    console.log('   • 6 issued certificates with verification codes');
    console.log('   • Multiple ticket types (Student, Professional, Premium)');
    console.log('   • Promo codes with usage tracking');
    console.log('   • Hybrid venue (physical + online)');
    console.log('   • World-class speakers with detailed profiles');
    console.log('   • Perfect for testing analytics, feedback, and certificates');
    console.log('');
    console.log('📊 Next Steps:');
    console.log('   1. Start your app: npm run dev:emulator');
    console.log('   2. Visit: http://localhost:5173');
    console.log('   3. Check Emulator UI: http://localhost:4000');
    console.log('   4. Start testing your features!');
    
  } catch (error) {
    console.error('❌ Sample data population failed:', error);
    process.exit(1);
  }
}

// Run the population
if (require.main === module) {
  populateSampleData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  populateSampleData, 
  generateSampleUsers, 
  generateSampleEvents, 
  generateSampleRegistrations, 
  generateSampleFeedback, 
  generateSampleCertificates 
};
