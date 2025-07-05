# Firebase Functions Integration for Event Creation

This document explains the Firebase Functions integration for the APOHUB event management platform.

## Overview

The Firebase Functions provide server-side logic for:
- Event data validation
- Event initialization
- Event publishing
- Event duplication
- Event statistics generation
- Real-time analytics updates

## Functions Implemented

### 1. `validate_event_data`
**Purpose**: Comprehensive server-side validation of event data before creation/update.

**Parameters**:
```typescript
{
  eventData: EventFormData
}
```

**Returns**:
```typescript
{
  isValid: boolean;
  errors: string[];
}
```

**Validation Rules**:
- Required fields: title, description, startDate, startTime
- Date validation (future dates, end after start)
- Venue validation (name required for offline events)
- Ticket type validation (positive prices, valid quantities)
- Payment configuration validation for paid events

### 2. `initialize_event`
**Purpose**: Initialize event after creation with subcollections and default data.

**Parameters**:
```typescript
{
  eventId: string
}
```

**Actions**:
- Creates analytics document
- Sets up default registration/feedback forms
- Initializes event metrics
- Sets up event tracking

### 3. `publish_event`
**Purpose**: Publish an event to make it visible to the public.

**Parameters**:
```typescript
{
  eventId: string
}
```

**Security**: Only event organizers and admins can publish events.

**Actions**:
- Final validation before publishing
- Updates event status to 'published'
- Sets publishedAt timestamp
- Triggers notification systems (future implementation)

### 4. `duplicate_event`
**Purpose**: Create a copy of an existing event.

**Parameters**:
```typescript
{
  eventId: string;
  newTitle?: string;
}
```

**Returns**:
```typescript
{
  success: boolean;
  newEventId: string;
}
```

**Actions**:
- Copies event data with modifications
- Resets attendee count to 0
- Sets status to 'draft'
- Copies form configurations

### 5. `get_event_statistics`
**Purpose**: Generate comprehensive event analytics.

**Parameters**:
```typescript
{
  eventId: string
}
```

**Returns**:
```typescript
{
  success: boolean;
  statistics: {
    eventId: string;
    registrationStats: {...};
    attendanceStats: {...};
    feedbackStats: {...};
    demographics: {...};
  }
}
```

## Firestore Triggers

### `on_event_created`
Triggered when a new event is created:
- Updates organizer statistics
- Logs event creation activity
- Initializes tracking

### `on_event_updated`
Triggered when an event is updated:
- Detects event publication
- Updates analytics data
- Logs activity changes

## Security Implementation

### Authentication
All functions require user authentication except for public data access.

### Authorization
- **Admins**: Full access to all functions
- **Organizers**: Access to their own events only
- **Public**: Read access to published events only

### Data Validation
- Server-side validation prevents malicious data
- Type checking and sanitization
- Business rule enforcement

## Client Integration

### EventService Updates

The `EventService` class has been updated to integrate with Firebase Functions:

```typescript
// Event creation with validation
const eventId = await EventService.createEvent(eventData, organizerUid);

// Event publishing
await EventService.publishEvent(eventId);

// Event duplication
const newEventId = await EventService.duplicateEvent(eventId, 'New Title');

// Statistics retrieval
const stats = await EventService.getEventStatistics(eventId);
```

### Error Handling

All functions include comprehensive error handling:
- Proper error codes for different scenarios
- Descriptive error messages
- Logging for debugging
- Graceful fallbacks where possible

## Deployment

### Prerequisites
1. Firebase project set up
2. Firebase CLI installed and authenticated
3. Python 3.9+ environment

### Deploy Functions
```bash
# Make deployment script executable
chmod +x deploy-functions.sh

# Deploy functions
./deploy-functions.sh
```

### Deploy Rules and Indexes
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

## Monitoring and Logging

### Function Logs
```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only validate_event_data
```

### Error Monitoring
- All errors are logged with context
- User actions are tracked
- Performance metrics available in Firebase Console

## Development Guidelines

### Adding New Functions
1. Add function to `main.py`
2. Update `EventService` client integration
3. Add tests (when test framework is set up)
4. Update documentation
5. Deploy and test

### Security Considerations
- Always validate user permissions
- Sanitize input data
- Use proper error handling
- Log security-relevant events

## Future Enhancements

### Planned Features
1. **Email Notifications**: Send emails on event publication/updates
2. **Payment Processing**: Integration with Paymongo webhooks
3. **Certificate Generation**: Automatic certificate creation
4. **Advanced Analytics**: Real-time dashboard updates
5. **Event Recommendations**: AI-powered event suggestions

### Performance Optimizations
1. **Caching**: Implement Redis for frequently accessed data
2. **Batch Operations**: Optimize bulk data operations
3. **Parallel Processing**: Async operations where possible
4. **Database Optimization**: Index optimization and query tuning

## Troubleshooting

### Common Issues

**Function timeout**:
- Increase timeout in function configuration
- Optimize database queries
- Implement pagination for large datasets

**Permission denied**:
- Check Firestore security rules
- Verify user authentication
- Confirm user roles in database

**Validation errors**:
- Check function logs for detailed error messages
- Verify input data format
- Ensure all required fields are provided

### Debug Commands
```bash
# Check function status
firebase functions:list

# View recent logs
firebase functions:log --limit 20

# Test function locally (requires Firebase emulator)
firebase emulators:start --only functions
```

## API Reference

For detailed API documentation, see the function docstrings in `functions/main.py`.

Each function includes:
- Parameter specifications
- Return value descriptions
- Error scenarios
- Usage examples
- Security considerations
