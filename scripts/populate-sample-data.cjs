#!/usr/bin/env node

/**
 * Populate Firebase Emulator with Sample Data
 * This script creates realistic test data for development
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { join } = require('path');

console.log('🎯 Populating Firebase Emulator with Sample Data');
console.log('💡 This creates realistic test data for development');
console.log('');

// Set emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

// Initialize Firebase Admin for Emulator
let app;
try {
  // For emulator, use the actual project ID
  app = initializeApp({
    projectId: 'apohub-gdgdvo' // Use the actual project ID
  });
  console.log('✅ Connected to Firebase Emulator');
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
    email: 'admin@gdgdavao.org',
    displayName: 'John Admin',
    role: 'admin',
    organization: 'GDG Davao',
    phoneNumber: '+639123456789',
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
    email: 'maria.organizer@gdgdavao.org',
    displayName: 'Maria Santos',
    role: 'organizer',
    organization: 'GDG Davao',
    phoneNumber: '+639987654321',
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
    email: 'carlos.dev@gdgdavao.org',
    displayName: 'Carlos Rodriguez',
    role: 'organizer',
    organization: 'GDG Davao',
    phoneNumber: '+639555123456',
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
      email: 'maria.organizer@gdgdavao.org'
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
      email: 'admin@gdgdavao.org'
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
      email: 'carlos.dev@gdgdavao.org'
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
      email: 'maria.organizer@gdgdavao.org'
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
      phoneNumber: '+639123456780',
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
      phoneNumber: '+639123456781',
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
      phoneNumber: '+639123456782',
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
      phoneNumber: '+639123456783',
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
      phoneNumber: '+639123456784',
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
      phoneNumber: '+639123456785',
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
      phoneNumber: '+639123456786',
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
      phoneNumber: '+639123456787',
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
      phoneNumber: '+639123456788',
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
      phoneNumber: '+639123456789',
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
    settingValue: 'admin@gdgdavao.org',
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
        password: 'password123', // Default password for testing
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
    console.log('   • 4 Events (3 published, 1 draft)');
    console.log('   • 10 Registrations across different events');
    console.log('     - 4 with paid status (confirmed)');
    console.log('     - 6 with pending payment status (need verification)');
    console.log('   • 1 Feedback submission');
    console.log('   • 1 Certificate');
    console.log('   • 4 System settings');
    console.log('   • 3 Activity logs');
    console.log('');
    console.log('🎯 Test Data Ready:');
    console.log('   • Login with: admin@gdgdavao.org / password123 (admin role)');
    console.log('   • Or: maria.organizer@gdgdavao.org / password123 (organizer role)');
    console.log('   • Or: carlos.dev@gdgdavao.org / password123 (organizer role)');
    console.log('   • Browse events, view registrations, check analytics');
    console.log('   • Test event creation, editing, and management');
    console.log('   • Use Payment Verification tab to approve/reject pending payments');
    console.log('');
    console.log('💳 Payment Verification Testing:');
    console.log('   • 6 registrations need payment verification');
    console.log('   • Navigate to Attendees page → Payment Verification tab');
    console.log('   • Approve or reject pending payments');
    console.log('   • Test payment workflow integration');
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
populateSampleData(); 