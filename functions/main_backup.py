"""
Firebase Functions for APOHUB Event Management Platform
Handles event creation, validation, publishing, and related operations.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from firebase_functions import https_fn, firestore_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore, storage, auth
from firebase_admin.exceptions import FirebaseError
from google.cloud.firestore_v1 import FieldFilter

# Initialize Firebase Admin
app = initialize_app()
db = firestore.client()
# Initialize storage bucket only when needed to avoid timeout issues
# bucket = storage.bucket()

# Set global options for cost control
set_global_options(max_instances=10)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EventValidationError(Exception):
    """Custom exception for event validation errors"""
    pass


class EventService:
    """Service class for event-related operations"""
    
    @staticmethod
    def validate_event_data(event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate event data for creation/update
        Returns validation result with errors if any
        """
        errors = []
        
        # Required fields validation
        required_fields = ['title', 'description', 'startDate', 'startTime']
        for field in required_fields:
            if not event_data.get(field):
                errors.append(f"Missing required field: {field}")
        
        # Date validation
        try:
            if event_data.get('startDate') and event_data.get('startTime'):
                start_datetime = datetime.fromisoformat(f"{event_data['startDate']}T{event_data['startTime']}")
                if start_datetime < datetime.now():
                    errors.append("Event start date must be in the future")
                    
            if event_data.get('endDate') and event_data.get('endTime'):
                end_datetime = datetime.fromisoformat(f"{event_data['endDate']}T{event_data['endTime']}")
                if start_datetime >= end_datetime:
                    errors.append("Event end date must be after start date")
        except ValueError as e:
            errors.append(f"Invalid date format: {str(e)}")
        
        # Venue validation
        if event_data.get('venueType') == 'offline':
            if not event_data.get('venueName'):
                errors.append("Venue name is required for offline events")
            if not event_data.get('city'):
                errors.append("City is required for offline events")
        
        # Ticket validation
        ticket_types = event_data.get('ticketTypes', [])
        if ticket_types:
            for i, ticket in enumerate(ticket_types):
                if not ticket.get('name'):
                    errors.append(f"Ticket type {i+1} name is required")
                if ticket.get('price', 0) < 0:
                    errors.append(f"Ticket type {i+1} price cannot be negative")
                if ticket.get('maxQuantity', 0) < 0:
                    errors.append(f"Ticket type {i+1} max quantity cannot be negative")
        
        # Payment config validation for paid events
        if event_data.get('isPaid') and event_data.get('paymentConfig'):
            payment_config = event_data['paymentConfig']
            bank_details = payment_config.get('bankDetails', {})
            
            if not bank_details.get('bankName'):
                errors.append("Bank name is required for paid events")
            if not bank_details.get('accountName'):
                errors.append("Account name is required for paid events")
            if not bank_details.get('accountNumber'):
                errors.append("Account number is required for paid events")
            if not payment_config.get('instructions'):
                errors.append("Payment instructions are required for paid events")
        
        return {
            'isValid': len(errors) == 0,
            'errors': errors
        }
    
    @staticmethod
    def generate_event_statistics(event_id: str) -> Dict[str, Any]:
        """Generate comprehensive event statistics"""
        try:
            # Get event document
            event_ref = db.collection('events').document(event_id)
            event_doc = event_ref.get()
            
            if not event_doc.exists:
                raise EventValidationError(f"Event {event_id} not found")
            
            event_data = event_doc.to_dict()
            
            # Get registrations
            registrations = db.collection('registrations').where(
                filter=FieldFilter('eventId', '==', event_id)
            ).stream()
            
            registration_stats = {
                'total': 0,
                'paid': 0,
                'free': 0,
                'pending': 0,
                'confirmed': 0,
                'cancelled': 0,
                'revenue': 0
            }
            
            attendance_stats = {
                'checkedIn': 0,
                'noShows': 0,
                'attendanceRate': 0
            }
            
            feedback_stats = {
                'responses': 0,
                'averageRating': 0,
                'responseRate': 0
            }
            
            demographics = {
                'organizations': {},
                'locations': {},
                'experience': {}
            }
            
            for reg in registrations:
                reg_data = reg.to_dict()
                registration_stats['total'] += 1
                
                # Payment status
                if reg_data.get('paymentStatus') == 'paid':
                    registration_stats['paid'] += 1
                    registration_stats['revenue'] += reg_data.get('totalAmount', 0)
                else:
                    registration_stats['free'] += 1
                
                # Registration status
                status = reg_data.get('registrationStatus', 'pending')
                registration_stats[status] = registration_stats.get(status, 0) + 1
                
                # Attendance
                if reg_data.get('attendanceStatus') == 'checked_in':
                    attendance_stats['checkedIn'] += 1
                elif reg_data.get('attendanceStatus') == 'no_show':
                    attendance_stats['noShows'] += 1
                
                # Feedback
                if reg_data.get('feedbackSubmitted'):
                    feedback_stats['responses'] += 1
                
                # Demographics
                user_details = reg_data.get('userDetails', {})
                org = user_details.get('organization', 'Not specified')
                demographics['organizations'][org] = demographics['organizations'].get(org, 0) + 1
            
            # Calculate rates
            if registration_stats['total'] > 0:
                attendance_stats['attendanceRate'] = (
                    attendance_stats['checkedIn'] / registration_stats['total'] * 100
                )
                feedback_stats['responseRate'] = (
                    feedback_stats['responses'] / registration_stats['total'] * 100
                )
            
            return {
                'eventId': event_id,
                'eventTitle': event_data.get('title', 'Unknown'),
                'generatedAt': datetime.now().isoformat(),
                'registrationStats': registration_stats,
                'attendanceStats': attendance_stats,
                'feedbackStats': feedback_stats,
                'demographics': demographics
            }
            
        except Exception as e:
            logger.error(f"Error generating statistics for event {event_id}: {str(e)}")
            raise


# Firebase Functions

@https_fn.on_call()
def validate_event_data(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Validate event data before creation/update
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_data = req.data.get('eventData')
        if not event_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event data is required"
            )
        
        validation_result = EventService.validate_event_data(event_data)
        
        logger.info(f"Event validation completed for user {req.auth.uid}")
        return validation_result
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error validating event data: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during validation"
        )


@https_fn.on_call()
def validateEventData(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Validate event data before creation/update (camelCase alias)
    """
    return validate_event_data(req)


@https_fn.on_call()
def initialize_event(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Initialize event after creation - set up subcollections and default data
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        if not event_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID is required"
            )
        
        # Verify event exists and user has permission
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check if user is organizer or admin
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Initialize analytics document
        analytics_ref = db.collection('event_analytics').document(event_id)
        analytics_ref.set({
            'eventId': event_id,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'lastUpdated': firestore.SERVER_TIMESTAMP,
            'registrationCount': 0,
            'revenue': 0,
            'checkedInCount': 0,
            'feedbackCount': 0
        })
        
        # Create default form templates if not provided
        forms_ref = db.collection('events').document(event_id).collection('forms')
        
        # Default registration form
        forms_ref.document('registration').set({
            'type': 'registration',
            'fields': [
                {
                    'id': 'name',
                    'type': 'text',
                    'label': 'Full Name',
                    'required': True,
                    'gridSize': 'full'
                },
                {
                    'id': 'email',
                    'type': 'email',
                    'label': 'Email Address',
                    'required': True,
                    'gridSize': 'half'
                },
                {
                    'id': 'phone',
                    'type': 'phone',
                    'label': 'Phone Number',
                    'required': True,
                    'gridSize': 'half'
                }
            ],
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        # Default feedback form
        forms_ref.document('feedback').set({
            'type': 'feedback',
            'fields': [
                {
                    'id': 'overall_rating',
                    'type': 'rating',
                    'label': 'Overall Event Rating',
                    'required': True,
                    'gridSize': 'full'
                },
                {
                    'id': 'liked_most',
                    'type': 'textarea',
                    'label': 'What did you like most?',
                    'required': False,
                    'gridSize': 'full'
                },
                {
                    'id': 'improvements',
                    'type': 'textarea',
                    'label': 'Areas for improvement',
                    'required': False,
                    'gridSize': 'full'
                }
            ],
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Event {event_id} initialized successfully")
        return {
            'success': True,
            'message': 'Event initialized successfully',
            'eventId': event_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error initializing event: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during initialization"
        )


@https_fn.on_call()
def publish_event(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Publish an event - make it visible to public
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        if not event_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID is required"
            )
        
        # Get event and verify permissions
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Final validation before publishing
        validation_result = EventService.validate_event_data(event_data)
        if not validation_result['isValid']:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Cannot publish event with validation errors: {', '.join(validation_result['errors'])}"
            )
        
        # Update event status
        event_ref.update({
            'status': 'published',
            'isPublished': True,
            'publishedAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Event {event_id} published successfully by user {req.auth.uid}")
        return {
            'success': True,
            'message': 'Event published successfully',
            'eventId': event_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error publishing event: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during publishing"
        )


@https_fn.on_call()
def duplicate_event(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Duplicate an existing event
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        new_title = req.data.get('newTitle')
        
        if not event_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID is required"
            )
        
        # Get original event
        original_event_ref = db.collection('events').document(event_id)
        original_event_doc = original_event_ref.get()
        
        if not original_event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Original event not found"
            )
        
        original_event_data = original_event_doc.to_dict()
        organizer_uid = original_event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Create new event document
        new_event_ref = db.collection('events').document()
        new_event_id = new_event_ref.id
        
        # Copy event data with modifications
        new_event_data = original_event_data.copy()
        new_event_data.update({
            'title': new_title or f"{original_event_data.get('title', 'Event')} (Copy)",
            'status': 'draft',
            'isPublished': False,
            'currentAttendees': 0,
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        # Remove fields that shouldn't be copied
        fields_to_remove = ['publishedAt', 'completedAt']
        for field in fields_to_remove:
            new_event_data.pop(field, None)
        
        # Create new event
        new_event_ref.set(new_event_data)
        
        # Copy forms subcollection
        original_forms = original_event_ref.collection('forms').stream()
        new_forms_ref = new_event_ref.collection('forms')
        
        for form_doc in original_forms:
            form_data = form_doc.to_dict()
            form_data.update({
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            new_forms_ref.document(form_doc.id).set(form_data)
        
        logger.info(f"Event {event_id} duplicated successfully as {new_event_id}")
        return {
            'success': True,
            'message': 'Event duplicated successfully',
            'newEventId': new_event_id,
            'originalEventId': event_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error duplicating event: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during duplication"
        )


@https_fn.on_call()
def get_event_statistics(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get comprehensive event statistics
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        if not event_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID is required"
            )
        
        # Verify event exists and user has permission
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Generate statistics
        statistics = EventService.generate_event_statistics(event_id)
        
        logger.info(f"Statistics generated for event {event_id}")
        return {
            'success': True,
            'statistics': statistics
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error getting event statistics: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error getting statistics"
        )


@https_fn.on_call()
def getEventStatistics(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get comprehensive event statistics (camelCase alias)
    """
    return get_event_statistics(req)


@https_fn.on_call()
def getEventAnalytics(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get event analytics summary
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        if not event_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID is required"
            )
        
        # Verify event exists and user has permission
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Get analytics data
        analytics_ref = db.collection('event_analytics').document(event_id)
        analytics_doc = analytics_ref.get()
        
        if analytics_doc.exists:
            analytics_data = analytics_doc.to_dict()
        else:
            # Create default analytics if not exists
            analytics_data = {
                'eventId': event_id,
                'registrationCount': 0,
                'revenue': 0,
                'checkedInCount': 0,
                'feedbackCount': 0,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            }
            analytics_ref.set(analytics_data)
        
        logger.info(f"Analytics retrieved for event {event_id}")
        return {
            'success': True,
            'analytics': analytics_data
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error getting event analytics: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error getting analytics"
        )


@https_fn.on_call()
def deleteEventData(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Delete event and all associated data
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        if not event_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID is required"
            )
        
        # Verify event exists and user has permission
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Check if event has registrations
        registrations = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).limit(1).stream()
        
        has_registrations = len(list(registrations)) > 0
        
        if has_registrations and not req.data.get('forceDelete', False):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Cannot delete event with registrations. Use forceDelete=true to override."
            )
        
        # Delete event subcollections
        # Delete forms
        forms_ref = event_ref.collection('forms')
        forms_docs = forms_ref.stream()
        for form_doc in forms_docs:
            form_doc.reference.delete()
        
        # Delete registrations
        registrations_ref = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        )
        registrations_docs = registrations_ref.stream()
        for reg_doc in registrations_docs:
            reg_doc.reference.delete()
        
        # Delete analytics
        analytics_ref = db.collection('event_analytics').document(event_id)
        if analytics_ref.get().exists:
            analytics_ref.delete()
        
        # Delete main event document
        event_ref.delete()
        
        # Log deletion
        db.collection('activity_logs').add({
            'type': 'event_deleted',
            'eventId': event_id,
            'userId': req.auth.uid,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'eventTitle': event_data.get('title', 'Unknown')
        })
        
        logger.info(f"Event {event_id} deleted successfully by user {req.auth.uid}")
        return {
            'success': True,
            'message': 'Event deleted successfully',
            'eventId': event_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error deleting event: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during deletion"
        )


@https_fn.on_call()
def registerForEvent(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Register a user for an event
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        registration_data = req.data.get('registrationData')
        
        if not event_id or not registration_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID and registration data are required"
            )
        
        # Verify event exists and is published
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        
        if not event_data.get('isPublished', False):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Event is not published"
            )
        
        # Check if event is full
        current_attendees = event_data.get('currentAttendees', 0)
        max_attendees = event_data.get('maxAttendees')
        
        if max_attendees and current_attendees >= max_attendees:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Event is full"
            )
        
        # Check if user already registered
        existing_registration = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('userId', '==', req.auth.uid)
        ).limit(1).stream()
        
        if len(list(existing_registration)) > 0:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.ALREADY_EXISTS,
                message="User already registered for this event"
            )
        
        # Create registration document
        registration_ref = db.collection('registrations').document()
        registration_id = registration_ref.id
        
        registration = {
            'id': registration_id,
            'eventId': event_id,
            'userId': req.auth.uid,
            'registrationData': registration_data,
            'registrationStatus': 'pending',
            'paymentStatus': 'unpaid' if event_data.get('ticketTypes', [{}])[0].get('price', 0) > 0 else 'free',
            'attendanceStatus': 'not_attended',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        registration_ref.set(registration)
        
        # Update event attendee count
        event_ref.update({
            'currentAttendees': current_attendees + 1,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        # Update analytics
        analytics_ref = db.collection('event_analytics').document(event_id)
        analytics_doc = analytics_ref.get()
        
        if analytics_doc.exists:
            analytics_data = analytics_doc.to_dict()
            analytics_ref.update({
                'registrationCount': analytics_data.get('registrationCount', 0) + 1,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            })
        
        logger.info(f"User {req.auth.uid} registered for event {event_id}")
        return {
            'success': True,
            'message': 'Registration successful',
            'registrationId': registration_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error registering for event: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during registration"
        )


@https_fn.on_call()
def processPaymentVerification(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Process payment verification for event registration
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        registration_id = req.data.get('registrationId')
        payment_data = req.data.get('paymentData')
        action = req.data.get('action', 'verify')  # 'verify' or 'reject'
        
        if not registration_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Registration ID is required"
            )
        
        # Get registration
        registration_ref = db.collection('registrations').document(registration_id)
        registration_doc = registration_ref.get()
        
        if not registration_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Registration not found"
            )
        
        registration_data = registration_doc.to_dict()
        event_id = registration_data.get('eventId')
        
        # Check permissions (organizer or admin)
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Update registration status
        update_data = {
            'updatedAt': firestore.SERVER_TIMESTAMP
        }
        
        if action == 'verify':
            update_data.update({
                'paymentStatus': 'paid',
                'registrationStatus': 'confirmed',
                'paymentVerifiedAt': firestore.SERVER_TIMESTAMP,
                'verifiedBy': req.auth.uid
            })
            
            if payment_data:
                update_data['paymentData'] = payment_data
                
        elif action == 'reject':
            update_data.update({
                'paymentStatus': 'rejected',
                'registrationStatus': 'rejected',
                'rejectedAt': firestore.SERVER_TIMESTAMP,
                'rejectedBy': req.auth.uid,
                'rejectionReason': req.data.get('reason', 'Payment verification failed')
            })
        
        registration_ref.update(update_data)
        
        # Update analytics
        if action == 'verify':
            analytics_ref = db.collection('event_analytics').document(event_id)
            analytics_doc = analytics_ref.get()
            
            if analytics_doc.exists:
                analytics_data = analytics_doc.to_dict()
                analytics_ref.update({
                    'revenue': analytics_data.get('revenue', 0) + payment_data.get('amount', 0),
                    'lastUpdated': firestore.SERVER_TIMESTAMP
                })
        
        logger.info(f"Payment {action} processed for registration {registration_id}")
        return {
            'success': True,
            'message': f'Payment {action} processed successfully',
            'registrationId': registration_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error processing payment verification: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during payment processing"
        )


@https_fn.on_call()
def submitFeedback(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Submit feedback for an event
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        feedback_data = req.data.get('feedbackData')
        
        if not event_id or not feedback_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID and feedback data are required"
            )
        
        # Verify user is registered for the event
        registration_query = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('userId', '==', req.auth.uid)
        ).limit(1).stream()
        
        registrations = list(registration_query)
        if len(registrations) == 0:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="User not registered for this event"
            )
        
        registration = registrations[0]
        registration_data = registration.to_dict()
        
        # Check if feedback already submitted
        if registration_data.get('feedbackSubmitted', False):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.ALREADY_EXISTS,
                message="Feedback already submitted for this event"
            )
        
        # Create feedback document
        feedback_ref = db.collection('feedback').document()
        feedback_id = feedback_ref.id
        
        feedback = {
            'id': feedback_id,
            'eventId': event_id,
            'userId': req.auth.uid,
            'registrationId': registration.id,
            'feedbackData': feedback_data,
            'createdAt': firestore.SERVER_TIMESTAMP
        }
        
        feedback_ref.set(feedback)
        
        # Update registration to mark feedback as submitted
        registration.reference.update({
            'feedbackSubmitted': True,
            'feedbackSubmittedAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        # Update analytics
        analytics_ref = db.collection('event_analytics').document(event_id)
        analytics_doc = analytics_ref.get()
        
        if analytics_doc.exists:
            analytics_data = analytics_doc.to_dict()
            analytics_ref.update({
                'feedbackCount': analytics_data.get('feedbackCount', 0) + 1,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            })
        
        logger.info(f"Feedback submitted for event {event_id} by user {req.auth.uid}")
        return {
            'success': True,
            'message': 'Feedback submitted successfully',
            'feedbackId': feedback_id
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during feedback submission"
        )


@https_fn.on_call()
def generateCertificate(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Generate certificate for event attendee
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        attendee_id = req.data.get('attendeeId')
        
        if not event_id or not attendee_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID and attendee ID are required"
            )
        
        # Verify event exists
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        
        # Verify attendee registration
        registration_query = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('userId', '==', attendee_id)
        ).limit(1).stream()
        
        registrations = list(registration_query)
        if len(registrations) == 0:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Registration not found"
            )
        
        registration = registrations[0]
        registration_data = registration.to_dict()
        
        # Check if attendee completed the event (submitted feedback)
        if not registration_data.get('feedbackSubmitted', False):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Certificate can only be generated after feedback submission"
            )
        
        # Check if certificate already exists
        certificate_query = db.collection('certificates').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('userId', '==', attendee_id)
        ).limit(1).stream()
        
        existing_certificates = list(certificate_query)
        if len(existing_certificates) > 0:
            certificate_data = existing_certificates[0].to_dict()
            return {
                'success': True,
                'message': 'Certificate already exists',
                'certificateId': certificate_data.get('id'),
                'downloadUrl': certificate_data.get('downloadUrl')
            }
        
        # Get user details
        user_ref = db.collection('users').document(attendee_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="User not found"
            )
        
        user_data = user_doc.to_dict()
        
        # Generate certificate ID
        certificate_ref = db.collection('certificates').document()
        certificate_id = certificate_ref.id
        
        # Create certificate record
        certificate_data = {
            'id': certificate_id,
            'eventId': event_id,
            'userId': attendee_id,
            'eventTitle': event_data.get('title', 'Event'),
            'attendeeName': user_data.get('displayName', 'Attendee'),
            'attendeeEmail': user_data.get('email', ''),
            'issueDate': firestore.SERVER_TIMESTAMP,
            'credentialId': f"APOHUB-{event_id[:8]}-{attendee_id[:8]}-{certificate_id[:8]}",
            'status': 'issued',
            'downloadUrl': f"https://certificates.apohub.dev/{certificate_id}",
            'createdAt': firestore.SERVER_TIMESTAMP
        }
        
        certificate_ref.set(certificate_data)
        
        # Update registration with certificate info
        registration.reference.update({
            'certificateGenerated': True,
            'certificateId': certificate_id,
            'certificateGeneratedAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Certificate generated for user {attendee_id} and event {event_id}")
        return {
            'success': True,
            'message': 'Certificate generated successfully',
            'certificateId': certificate_id,
            'credentialId': certificate_data['credentialId'],
            'downloadUrl': certificate_data['downloadUrl']
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error generating certificate: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during certificate generation"
        )


@https_fn.on_call()
def checkInAttendee(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Check in an attendee for an event
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        event_id = req.data.get('eventId')
        attendee_id = req.data.get('attendeeId')
        
        if not event_id or not attendee_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID and attendee ID are required"
            )
        
        # Verify event exists and user has permission
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            is_organizer = req.auth.uid == organizer_uid
            
            if not (is_admin or is_organizer):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Permission denied"
                )
        
        # Find registration
        registration_query = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('userId', '==', attendee_id)
        ).limit(1).stream()
        
        registrations = list(registration_query)
        if len(registrations) == 0:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Registration not found"
            )
        
        registration = registrations[0]
        registration_data = registration.to_dict()
        
        # Check if already checked in
        if registration_data.get('attendanceStatus') == 'checked_in':
            return {
                'success': True,
                'message': 'Attendee already checked in',
                'registrationId': registration.id,
                'checkedInAt': registration_data.get('checkedInAt')
            }
        
        # Update registration with check-in info
        registration.reference.update({
            'attendanceStatus': 'checked_in',
            'checkedInAt': firestore.SERVER_TIMESTAMP,
            'checkedInBy': req.auth.uid,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        # Update analytics
        analytics_ref = db.collection('event_analytics').document(event_id)
        analytics_doc = analytics_ref.get()
        
        if analytics_doc.exists:
            analytics_data = analytics_doc.to_dict()
            analytics_ref.update({
                'checkedInCount': analytics_data.get('checkedInCount', 0) + 1,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            })
        
        logger.info(f"Attendee {attendee_id} checked in for event {event_id}")
        return {
            'success': True,
            'message': 'Attendee checked in successfully',
            'registrationId': registration.id,
            'checkedInAt': firestore.SERVER_TIMESTAMP
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error checking in attendee: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during check-in"
        )


@https_fn.on_call()
def bulkProcessPayments(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Bulk process payment verifications for multiple registrations
    """
    try:
        if not req.auth:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                message="Authentication required"
            )
        
        registration_ids = req.data.get('registrationIds', [])
        action = req.data.get('action', 'verify')  # 'verify' or 'reject'
        
        if not registration_ids:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Registration IDs are required"
            )
        
        # Check admin permissions
        user_doc = db.collection('users').document(req.auth.uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            is_admin = user_data.get('role') == 'admin'
            
            if not is_admin:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                    message="Admin access required for bulk operations"
                )
        
        processed_count = 0
        failed_count = 0
        results = []
        
        for registration_id in registration_ids:
            try:
                # Create a mock request object for processPaymentVerification
                mock_req = type('MockRequest', (), {
                    'auth': req.auth,
                    'data': {
                        'registrationId': registration_id,
                        'action': action
                    }
                })()
                
                # Process each registration
                result = processPaymentVerification(mock_req)
                
                if result.get('success'):
                    processed_count += 1
                    results.append({
                        'registrationId': registration_id,
                        'status': 'success',
                        'message': result.get('message')
                    })
                else:
                    failed_count += 1
                    results.append({
                        'registrationId': registration_id,
                        'status': 'failed',
                        'message': result.get('message', 'Unknown error')
                    })
                    
            except Exception as e:
                failed_count += 1
                results.append({
                    'registrationId': registration_id,
                    'status': 'failed',
                    'message': str(e)
                })
        
        logger.info(f"Bulk payment processing completed: {processed_count} successful, {failed_count} failed")
        return {
            'success': True,
            'message': f'Bulk processing completed: {processed_count} successful, {failed_count} failed',
            'processed': processed_count,
            'failed': failed_count,
            'results': results
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in bulk payment processing: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during bulk processing"
        )


# Firestore Triggers

@firestore_fn.on_document_created(document="events/{eventId}")
def on_event_created(event: firestore_fn.Event[firestore_fn.DocumentSnapshot]) -> None:
    """
    Triggered when a new event is created
    """
    try:
        event_id = event.params['eventId']
        event_data = event.data.to_dict()
        
        logger.info(f"Event created: {event_id}")
        
        # Update organizer stats
        organizer_uid = event_data.get('organizer', {}).get('uid')
        if organizer_uid:
            organizer_ref = db.collection('users').document(organizer_uid)
            organizer_doc = organizer_ref.get()
            
            if organizer_doc.exists:
                organizer_data = organizer_doc.to_dict()
                current_events = organizer_data.get('eventsCreated', 0)
                organizer_ref.update({
                    'eventsCreated': current_events + 1,
                    'lastEventCreated': firestore.SERVER_TIMESTAMP
                })
        
        # Log event creation for analytics
        db.collection('activity_logs').add({
            'type': 'event_created',
            'eventId': event_id,
            'userId': organizer_uid,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'eventTitle': event_data.get('title', 'Unknown')
        })
        
    except Exception as e:
        logger.error(f"Error in event created trigger: {str(e)}")


@firestore_fn.on_document_updated(document="events/{eventId}")
def on_event_updated(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]) -> None:
    """
    Triggered when an event is updated
    """
    try:
        event_id = event.params['eventId']
        before_data = event.data.before.to_dict() if event.data.before else {}
        after_data = event.data.after.to_dict() if event.data.after else {}
        
        # Check if event was published
        was_published = before_data.get('isPublished', False)
        is_published = after_data.get('isPublished', False)
        
        if not was_published and is_published:
            logger.info(f"Event {event_id} was published")
            
            # Log event publication
            db.collection('activity_logs').add({
                'type': 'event_published',
                'eventId': event_id,
                'userId': after_data.get('organizer', {}).get('uid'),
                'timestamp': firestore.SERVER_TIMESTAMP,
                'eventTitle': after_data.get('title', 'Unknown')
            })
        
        # Update analytics if attendee count changed
        before_attendees = before_data.get('currentAttendees', 0)
        after_attendees = after_data.get('currentAttendees', 0)
        
        if before_attendees != after_attendees:
            analytics_ref = db.collection('event_analytics').document(event_id)
            analytics_ref.update({
                'registrationCount': after_attendees,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            })
        
    except Exception as e:
        logger.error(f"Error in event updated trigger: {str(e)}")


# Health check endpoint
@https_fn.on_request()
def health_check(req: https_fn.Request) -> https_fn.Response:
    """Health check endpoint for monitoring"""
    return https_fn.Response(
        json.dumps({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'service': 'apohub-functions'
        }),
        headers={'Content-Type': 'application/json'}
    )