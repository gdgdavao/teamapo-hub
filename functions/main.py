"""
Firebase Functions for APOHUB Event Management Platform
Handles event creation, validation, publishing, and related operations.
"""

import json
import logging
import os
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from firebase_functions import https_fn, firestore_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore, storage, auth
from firebase_admin.exceptions import FirebaseError
from google.cloud.firestore_v1 import FieldFilter
from email_service import email_service

# Global variables for Firebase Admin services (lazy initialization)
_app = None
_db = None

# Set global options for region and cost control
# Ensure region matches Firestore location in firebase.json (asia-southeast2)
set_global_options(region="asia-southeast2", max_instances=10)

# Ensure Firebase Admin SDK is initialized at import time so callable auth verification works
try:
    # If already initialized, this is a no-op
    from firebase_admin import _apps
    if not _apps:
        initialize_app()
except Exception as e:
    # Log but do not crash import; lazy init in get_db() remains as fallback
    logging.getLogger(__name__).warning(f"Admin SDK init at import failed or already initialized: {str(e)}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db():
    """Lazy initialization of Firestore client"""
    global _app, _db
    if _db is None:
        try:
            # Check if app is already initialized
            from firebase_admin import _apps
            if not _apps:
                _app = initialize_app()
            else:
                _app = None  # App already exists
            _db = firestore.client()
            logger.info("Firebase Admin client retrieved")
        except Exception as e:
            logger.error(f"Error during Firebase initialization: {str(e)}")
            raise
    return _db

# Alias for backward compatibility - use get_db() function instead


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

        # Helper to normalize datetimes for comparison
        def _normalize_dt(dt: datetime) -> datetime:
            return dt if dt.tzinfo is None else dt.replace(tzinfo=None)

        # Required fields validation (support both client shape and stored Firestore shape)
        for field in ['title', 'description']:
            if not event_data.get(field):
                errors.append(f"Missing required field: {field}")

        start_datetime = None
        end_datetime = None

        try:
            # Start datetime: handle either (date string + time string) or datetime value
            sd = event_data.get('startDate')
            st = event_data.get('startTime')
            if isinstance(sd, datetime):
                start_datetime = _normalize_dt(sd)
            elif isinstance(sd, dict) and sd.get('seconds') is not None:
                # Firestore Timestamp serialized as dict
                start_datetime = _normalize_dt(datetime.fromtimestamp(int(sd.get('seconds'))))
            elif sd and st:
                start_datetime = datetime.fromisoformat(f"{sd}T{st}")
            else:
                errors.append("Missing required field: startDate/startTime")

            # End datetime is optional, but if provided, must be after start
            ed = event_data.get('endDate')
            et = event_data.get('endTime')
            if isinstance(ed, datetime):
                end_datetime = _normalize_dt(ed)
            elif isinstance(ed, dict) and ed.get('seconds') is not None:
                end_datetime = _normalize_dt(datetime.fromtimestamp(int(ed.get('seconds'))))
            elif ed and et:
                end_datetime = datetime.fromisoformat(f"{ed}T{et}")

            # Temporal validations
            if start_datetime:
                if start_datetime < _normalize_dt(datetime.now()):
                    errors.append("Event start date must be in the future")
                if end_datetime and start_datetime >= end_datetime:
                    errors.append("Event end date must be after start date")
        except ValueError as e:
            errors.append(f"Invalid date format: {str(e)}")
        
        # Venue validation (support both client payload and stored Firestore shape)
        venue_type = event_data.get('venueType')
        venue_city = event_data.get('city')
        venue_name = event_data.get('venueName')
        venue_obj = event_data.get('venue') or {}
        if not venue_type and isinstance(venue_obj, dict):
            venue_type = venue_obj.get('type')
            venue_city = venue_obj.get('city', venue_city)
            venue_name = venue_obj.get('name', venue_name)

        if venue_type == 'offline':
            if not venue_name:
                errors.append("Venue name is required for offline events")
            if not venue_city:
                errors.append("City is required for offline events")
        
        # Ticket validation (defensively coerce None and strings)
        ticket_types = event_data.get('ticketTypes', [])
        if ticket_types:
            for i, ticket in enumerate(ticket_types):
                if not ticket.get('name'):
                    errors.append(f"Ticket type {i+1} name is required")
                price = ticket.get('price')
                try:
                    price_num = float(price) if price is not None else 0.0
                except (TypeError, ValueError):
                    price_num = 0.0
                if price_num < 0:
                    errors.append(f"Ticket type {i+1} price cannot be negative")
                max_qty = ticket.get('maxQuantity')
                if max_qty is not None:
                    try:
                        max_qty_num = int(max_qty)
                        if max_qty_num < 0:
                            errors.append(f"Ticket type {i+1} max quantity cannot be negative")
                    except (TypeError, ValueError):
                        errors.append(f"Ticket type {i+1} max quantity must be a number if provided")
        
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
            db = get_db()
            # Get event document
            event_ref = get_db().collection('events').document(event_id)
            event_doc = event_ref.get()
            
            if not event_doc.exists:
                raise EventValidationError(f"Event {event_id} not found")
            
            event_data = event_doc.to_dict()
            
            # Get registrations
            registrations = get_db().collection('registrations').where(
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
                attendance_stats['attendanceRate'] = int(
                    attendance_stats['checkedIn'] / registration_stats['total'] * 100
                )
                feedback_stats['responseRate'] = int(
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
        
        db = get_db()
        # Verify event exists and user has permission
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check if user is organizer or admin
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
        analytics_ref = get_db().collection('event_analytics').document(event_id)
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
        forms_ref = get_db().collection('events').document(event_id).collection('forms')
        
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
        db = get_db()
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
            # In emulator/development flows we prefer graceful failure to avoid noisy 400s;
            # return success=false so clients can choose to fallback.
            logger.warning(
                f"Publish validation failed for event {event_id}: {validation_result['errors']}"
            )
            return {
                'success': False,
                'message': 'Cannot publish event with validation errors',
                'errors': validation_result['errors'],
                'eventId': event_id
            }
        
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
        db = get_db()
        original_event_ref = get_db().collection('events').document(event_id)
        original_event_doc = original_event_ref.get()
        
        if not original_event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Original event not found"
            )
        
        original_event_data = original_event_doc.to_dict()
        organizer_uid = original_event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
        new_event_ref = get_db().collection('events').document()
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
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
        analytics_ref = get_db().collection('event_analytics').document(event_id)
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
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
        registrations = get_db().collection('registrations').where(
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
        registrations_ref = get_db().collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        )
        registrations_docs = registrations_ref.stream()
        for reg_doc in registrations_docs:
            reg_doc.reference.delete()
        
        # Delete analytics
        analytics_ref = get_db().collection('event_analytics').document(event_id)
        if analytics_ref.get().exists:
            analytics_ref.delete()
        
        # Delete main event document
        event_ref.delete()
        
        # Log deletion
        get_db().collection('activity_logs').add({
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
def validateRegistration(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Validate registration data without authentication (for anonymous registrations)
    """
    try:
        event_id = req.data.get('eventId')
        ticket_type_id = req.data.get('ticketTypeId')
        quantity = req.data.get('quantity', 1)
        promo_code = req.data.get('promoCode')
        
        if not event_id or not ticket_type_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Event ID and ticket type ID are required"
            )
        
        # Get event data
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        
        # Check if event is published
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
        
        # Find ticket type
        ticket_types = event_data.get('ticketTypes', [])
        ticket_type = None
        for tt in ticket_types:
            if tt.get('id') == ticket_type_id:
                ticket_type = tt
                break
        
        if not ticket_type:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Ticket type not found"
            )
        
        # Calculate pricing
        original_price = ticket_type.get('price', 0)
        current_price = original_price
        
        # Apply promo code if provided
        promo_code_data = None
        if promo_code:
            promoCodes = event_data.get('promoCodes', [])
            for pc in promoCodes:
                if pc.get('code') == promo_code and pc.get('isActive', False):
                    promo_code_data = pc
                    break
            
            if promo_code_data:
                discount_type = promo_code_data.get('discountType', 'percentage')
                discount_value = promo_code_data.get('discountValue', 0)
                
                if discount_type == 'percentage':
                    current_price = original_price * (1 - discount_value / 100)
                elif discount_type == 'fixed':
                    current_price = max(0, original_price - discount_value)
        
        # Calculate totals
        original_amount = original_price * quantity
        discount_amount = (original_price - current_price) * quantity
        total_amount = current_price * quantity
        
        return {
            'isValid': True,
            'pricing': {
                'originalPrice': original_price,
                'currentPrice': current_price,
                'discountAmount': discount_amount,
                'promoCode': promo_code_data
            },
            'message': 'Registration validation successful'
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error validating registration: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during validation"
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
        event_ref = get_db().collection('events').document(event_id)
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
        existing_registration = get_db().collection('registrations').where(
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
        registration_ref = get_db().collection('registrations').document()
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
        analytics_ref = get_db().collection('event_analytics').document(event_id)
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
        registration_ref = get_db().collection('registrations').document(registration_id)
        registration_doc = registration_ref.get()
        
        if not registration_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Registration not found"
            )
        
        registration_data = registration_doc.to_dict()
        event_id = registration_data.get('eventId')
        
        # Check permissions (organizer or admin)
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
            analytics_ref = get_db().collection('event_analytics').document(event_id)
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
        registration_query = get_db().collection('registrations').where(
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
        feedback_ref = get_db().collection('feedback').document()
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
        analytics_ref = get_db().collection('event_analytics').document(event_id)
        analytics_doc = analytics_ref.get()
        
        if analytics_doc.exists:
            analytics_data = analytics_doc.to_dict()
            analytics_ref.update({
                'feedbackCount': analytics_data.get('feedbackCount', 0) + 1,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            })
        
        # Get event title for email
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        event_title = 'Event'
        if event_doc.exists:
            event_data = event_doc.to_dict()
            event_title = event_data.get('title', 'Event')
        
        # Check if certificate exists and send notification email
        certificate_id = registration_data.get('certificateId')
        if certificate_id:
            try:
                cert_ref = get_db().collection('certificates').document(certificate_id)
                cert_doc = cert_ref.get()
                
                if cert_doc.exists:
                    cert_data = cert_doc.to_dict()
                    # Check for certificateUrl first (used by custom template system), then downloadUrl (backend placeholder)
                    certificate_url = cert_data.get('certificateUrl') or cert_data.get('downloadUrl')
                    
                    # Only send email if we have a valid, non-placeholder URL
                    # Placeholder URLs like "https://certificates.apohub.dev/{id}" should be skipped
                    # unless they're actually accessible
                    is_placeholder = certificate_url and (
                        certificate_url.startswith('https://certificates.apohub.dev/') or
                        certificate_url.startswith('blob:') or
                        certificate_url.startswith('data:')
                    )
                    
                    # For custom certificates, certificateUrl should be a Firebase Storage URL or similar
                    # If it's a placeholder, we'll skip sending the email as the certificate may not be ready
                    if certificate_url and not is_placeholder:
                        # Get user email and name
                        user_details = registration_data.get('userDetails', {})
                        user_email = user_details.get('email')
                        user_name = user_details.get('name', 'Attendee')
                        
                        if user_email:
                            # Send certificate notification email
                            try:
                                email_result = email_service.send_certificate_notification(
                                    user_email=user_email,
                                    user_name=user_name,
                                    event_title=event_title,
                                    certificate_url=certificate_url,
                                    registration_id=registration.id
                                )
                                
                                # Log activity
                                try:
                                    get_db().collection('activity_logs').add({
                                        'type': 'certificate_notification_sent',
                                        'eventId': event_id,
                                        'userEmail': user_email,
                                        'userName': user_name,
                                        'eventTitle': event_title,
                                        'certificateUrl': certificate_url,
                                        'registrationId': registration.id,
                                        'emailId': email_result.get('email_id'),
                                        'success': email_result.get('success', False),
                                        'timestamp': firestore.SERVER_TIMESTAMP
                                    })
                                except Exception as log_err:
                                    logger.warning(f"Failed to write activity log for certificate notification: {str(log_err)}")
                                
                                # Update registration if email sent successfully
                                if email_result.get('success'):
                                    registration.reference.update({
                                        'certificateEmailSent': True,
                                        'certificateEmailSentAt': firestore.SERVER_TIMESTAMP,
                                        'updatedAt': firestore.SERVER_TIMESTAMP
                                    })
                                    logger.info(f"Certificate notification sent successfully to {user_email} for event {event_id}")
                                else:
                                    logger.warning(f"Failed to send certificate notification to {user_email}: {email_result.get('message')}")
                                    
                            except Exception as email_err:
                                logger.error(f"Error sending certificate notification email: {str(email_err)}")
                                # Don't fail feedback submission if email fails
                        else:
                            logger.warning(f"No email address found for registration {registration.id}, skipping certificate notification")
                    elif is_placeholder:
                        logger.info(f"Certificate {certificate_id} has placeholder URL, skipping email notification. Certificate may need to be generated/uploaded first.")
                    else:
                        logger.warning(f"Certificate {certificate_id} exists but has no valid certificate URL")
                else:
                    logger.info(f"Certificate {certificate_id} not found, skipping certificate notification")
            except Exception as cert_err:
                logger.error(f"Error checking certificate for registration {registration.id}: {str(cert_err)}")
                # Don't fail feedback submission if certificate check fails
        
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
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        
        # Verify attendee registration
        registration_query = get_db().collection('registrations').where(
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
        certificate_query = get_db().collection('certificates').where(
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
        user_ref = get_db().collection('users').document(attendee_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="User not found"
            )
        
        user_data = user_doc.to_dict()
        
        # Generate certificate ID
        certificate_ref = get_db().collection('certificates').document()
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
        event_ref = get_db().collection('events').document(event_id)
        event_doc = event_ref.get()
        
        if not event_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Event not found"
            )
        
        event_data = event_doc.to_dict()
        organizer_uid = event_data.get('organizer', {}).get('uid')
        
        # Check permissions
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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
        registration_query = get_db().collection('registrations').where(
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
        analytics_ref = get_db().collection('event_analytics').document(event_id)
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
        user_doc = get_db().collection('users').document(req.auth.uid).get()
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


# Callable utilities for notifications/emails
@https_fn.on_call()
def sendConfirmationEmail(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send a registration confirmation email using Resend.
    Supports different email types: 'submitted' (immediate) or 'approved' (with QR code and registration ID)
    """
    try:
        data: Dict[str, Any] = req.data or {}
        registration_id = data.get('registrationId')
        event_id = data.get('eventId')
        user_email = data.get('userEmail')
        user_name = data.get('userName', 'Attendee')
        requires_payment = data.get('requiresPayment', False)
        email_type = data.get('emailType', 'submitted')  # 'submitted' or 'approved'

        if not event_id or not user_email:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="eventId and userEmail are required"
            )

        # Get event details for email content
        try:
            event_ref = get_db().collection('events').document(event_id)
            event_doc = event_ref.get()
            
            if not event_doc.exists:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.NOT_FOUND,
                    message="Event not found"
                )
            
            event_data = event_doc.to_dict()
            event_title = event_data.get('title', 'Event')
            
            # Debug: Log event data structure
            logger.info(f"Event data keys: {list(event_data.keys())}")
            logger.info(f"startDate value: {event_data.get('startDate')} (type: {type(event_data.get('startDate'))})")
            logger.info(f"venue value: {event_data.get('venue')}")
            
            # Get proper event date and location from Firestore
            event_date = 'TBD'
            event_location = 'TBD'
            
            # Extract date from startDate (Firestore Timestamp) with proper timezone handling
            start_date = event_data.get('startDate')
            event_timezone = event_data.get('timezone', 'Asia/Manila')  # Default to Manila timezone
            
            if start_date:
                try:
                    from datetime import datetime
                    import pytz
                    
                    # Parse the timezone
                    try:
                        tz = pytz.timezone(event_timezone)
                    except pytz.exceptions.UnknownTimeZoneError:
                        logger.warning(f"Unknown timezone: {event_timezone}, using Asia/Manila")
                        tz = pytz.timezone('Asia/Manila')
                    
                    # Handle Firestore timestamp object
                    if hasattr(start_date, 'seconds'):
                        # Convert UTC timestamp to the event's timezone
                        dt_utc = datetime.utcfromtimestamp(start_date.seconds).replace(tzinfo=pytz.UTC)
                        dt_local = dt_utc.astimezone(tz)
                        event_date = dt_local.strftime('%B %d, %Y at %I:%M %p')
                    elif isinstance(start_date, dict) and 'seconds' in start_date:
                        # Handle serialized timestamp
                        dt_utc = datetime.utcfromtimestamp(start_date['seconds']).replace(tzinfo=pytz.UTC)
                        dt_local = dt_utc.astimezone(tz)
                        event_date = dt_local.strftime('%B %d, %Y at %I:%M %p')
                    elif isinstance(start_date, str):
                        # Handle ISO string
                        dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                        if dt.tzinfo is None:
                            dt = pytz.UTC.localize(dt)
                        dt_local = dt.astimezone(tz)
                        event_date = dt_local.strftime('%B %d, %Y at %I:%M %p')
                    else:
                        logger.warning(f"Unknown startDate format: {type(start_date)} - {start_date}")
                        event_date = str(start_date)
                except Exception as date_err:
                    logger.warning(f"Failed to parse event date: {str(date_err)}")
                    logger.warning(f"startDate type: {type(start_date)}, value: {start_date}")
                    event_date = str(start_date)
            
            # Get venue information - handle both nested venue object and flat structure
            venue = event_data.get('venue', {})
            venue_type = venue.get('type') or event_data.get('venueType')
            
            logger.info(f"venue_type: {venue_type}")
            
            if venue_type == 'online':
                event_location = venue.get('onlineUrl') or venue.get('url') or 'Online Event'
            elif venue_type == 'offline':
                # Try nested venue object first, then flat structure
                venue_name = venue.get('name') or event_data.get('venueName', '')
                venue_address = venue.get('address') or event_data.get('venueAddress', '')
                venue_city = venue.get('city') or event_data.get('city', '')
                
                # Build location string from available parts
                location_parts = []
                if venue_name:
                    location_parts.append(venue_name)
                if venue_address:
                    location_parts.append(venue_address)
                if venue_city:
                    location_parts.append(venue_city)
                
                event_location = ', '.join(location_parts) if location_parts else 'TBD'
                logger.info(f"Built location: {event_location} from parts: {location_parts}")
            else:
                logger.info(f"Unknown venue type: {venue_type}, using TBD")
            
            # Generate QR code only for approved registrations
            qr_code_data = None
            include_registration_id = None
            
            if email_type == 'approved' and registration_id:
                include_registration_id = registration_id
                try:
                    import qrcode
                    from io import BytesIO
                    import base64
                    from PIL import Image
                    
                    # Create QR code with optimized settings for email
                    qr = qrcode.QRCode(
                        version=1,
                        error_correction=qrcode.constants.ERROR_CORRECT_L,
                        box_size=6,  # Reduced from 10 for smaller file size
                        border=2     # Reduced from 5 for smaller file size
                    )
                    qr.add_data(f"registration:{registration_id}")
                    qr.make(fit=True)
                    
                    # Generate image with optimization
                    img = qr.make_image(fill_color="black", back_color="white")
                    
                    # Convert to RGB if needed and optimize
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Save with optimization for email clients
                    buffer = BytesIO()
                    img.save(buffer, format='PNG', optimize=True)
                    buffer.seek(0)
                    qr_code_data = base64.b64encode(buffer.getvalue()).decode()
                    
                    logger.info(f"QR code generated successfully. Size: {len(qr_code_data)} bytes")
                except Exception as qr_err:
                    logger.warning(f"Failed to generate QR code: {str(qr_err)}")

            # Send email using Resend
            email_result = email_service.send_registration_confirmation(
                user_email=user_email,
                user_name=user_name,
                event_title=event_title,
                event_date=event_date,
                event_location=event_location,
                registration_id=include_registration_id,
                qr_code_data=qr_code_data,
                requires_payment=requires_payment
            )

            # Log activity for traceability
            try:
                get_db().collection('activity_logs').add({
                    'type': 'email_confirmation_sent',
                    'registrationId': registration_id,
                    'eventId': event_id,
                    'eventTitle': event_title,
                    'userEmail': user_email,
                    'userName': user_name,
                    'emailId': email_result.get('email_id'),
                    'success': email_result.get('success', False),
                    'timestamp': firestore.SERVER_TIMESTAMP
                })
            except Exception as log_err:
                logger.warning(f"Failed to write activity log for confirmation email: {str(log_err)}")

            if email_result.get('success'):
                logger.info(f"Registration confirmation email sent to {user_email} (registration {registration_id})")
                return {
                    'success': True,
                    'message': 'Confirmation email sent successfully',
                    'registrationId': registration_id,
                    'eventId': event_id,
                    'emailId': email_result.get('email_id')
                }
            else:
                logger.error(f"Failed to send confirmation email to {user_email}: {email_result.get('message')}")
                return {
                    'success': False,
                    'message': f"Failed to send confirmation email: {email_result.get('message')}",
                    'registrationId': registration_id,
                    'eventId': event_id
                }

        except https_fn.HttpsError:
            raise
        except Exception as event_err:
            logger.error(f"Error getting event details: {str(event_err)}")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message="Internal server error getting event details"
            )

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in sendConfirmationEmail: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error sending confirmation email"
        )


@https_fn.on_call()
def sendPaymentNotification(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send payment status notification email using Resend.
    """
    try:
        data: Dict[str, Any] = req.data or {}
        registration_id = data.get('registrationId')
        status = data.get('status')  # expected: 'approved' | 'rejected' | 'pending'
        event_title = data.get('eventTitle')
        attendee_email = data.get('attendeeEmail')
        attendee_name = data.get('attendeeName', 'Attendee')
        payment_instructions = data.get('paymentInstructions')

        if not registration_id or not status:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="registrationId and status are required"
            )

        if not attendee_email:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="attendeeEmail is required"
            )

        # Generate QR code for approved payments (for event check-in)
        qr_code_data = None
        if status == 'approved' and registration_id:
            try:
                import qrcode
                from io import BytesIO
                import base64
                from PIL import Image
                
                # Create QR code with optimized settings for email
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=6,  # Reduced from 10 for smaller file size
                    border=2     # Reduced from 5 for smaller file size
                )
                qr.add_data(f"registration:{registration_id}")
                qr.make(fit=True)
                
                # Generate image with optimization
                img = qr.make_image(fill_color="black", back_color="white")
                
                # Convert to RGB if needed and optimize
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Save with optimization for email clients
                buffer = BytesIO()
                img.save(buffer, format='PNG', optimize=True)
                buffer.seek(0)
                qr_code_data = base64.b64encode(buffer.getvalue()).decode()
                
                logger.info(f"QR code generated successfully. Size: {len(qr_code_data)} bytes")
            except Exception as qr_err:
                logger.warning(f"Failed to generate QR code for payment notification: {str(qr_err)}")

        # Send email using Resend
        email_result = email_service.send_payment_notification(
            user_email=attendee_email,
            user_name=attendee_name,
            event_title=event_title or 'Event',
            registration_id=registration_id,
            status=status,
            payment_instructions=payment_instructions,
            qr_code_data=qr_code_data
        )

        # Log activity for traceability
        try:
            # Get eventId from registration
            event_id = None
            try:
                reg_ref = get_db().collection('registrations').document(registration_id)
                reg_doc = reg_ref.get()
                if reg_doc.exists:
                    event_id = reg_doc.to_dict().get('eventId')
            except Exception:
                pass
            
            get_db().collection('activity_logs').add({
                'type': 'payment_notification_sent',
                'registrationId': registration_id,
                'eventId': event_id,
                'status': status,
                'eventTitle': event_title,
                'userEmail': attendee_email,
                'userName': attendee_name,
                'emailId': email_result.get('email_id'),
                'success': email_result.get('success', False),
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as log_err:
            logger.warning(f"Failed to write activity log for payment notification: {str(log_err)}")

        if email_result.get('success'):
            logger.info(f"Payment notification email sent to {attendee_email} for registration {registration_id} with status {status}")
            return {
                'success': True,
                'message': 'Payment notification sent successfully',
                'registrationId': registration_id,
                'status': status,
                'emailId': email_result.get('email_id')
            }
        else:
            logger.error(f"Failed to send payment notification to {attendee_email}: {email_result.get('message')}")
            return {
                'success': False,
                'message': f"Failed to send payment notification: {email_result.get('message')}",
                'registrationId': registration_id,
                'status': status
            }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in sendPaymentNotification: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error sending payment notification"
        )


@https_fn.on_call()
def sendCertificateNotification(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send certificate ready notification email using Resend.
    """
    try:
        data: Dict[str, Any] = req.data or {}
        user_email = data.get('userEmail')
        user_name = data.get('userName', 'Attendee')
        event_title = data.get('eventTitle')
        certificate_url = data.get('certificateUrl')
        registration_id = data.get('registrationId')

        if not user_email or not event_title or not certificate_url:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="userEmail, eventTitle, and certificateUrl are required"
            )

        # Send email using Resend
        email_result = email_service.send_certificate_notification(
            user_email=user_email,
            user_name=user_name,
            event_title=event_title,
            certificate_url=certificate_url,
            registration_id=registration_id or 'unknown'
        )

        # Log activity for traceability
        try:
            # Get eventId from registration
            event_id = None
            try:
                if registration_id:
                    reg_ref = get_db().collection('registrations').document(registration_id)
                    reg_doc = reg_ref.get()
                    if reg_doc.exists:
                        event_id = reg_doc.to_dict().get('eventId')
            except Exception:
                pass
            
            get_db().collection('activity_logs').add({
                'type': 'certificate_notification_sent',
                'eventId': event_id,
                'userEmail': user_email,
                'userName': user_name,
                'eventTitle': event_title,
                'certificateUrl': certificate_url,
                'registrationId': registration_id,
                'emailId': email_result.get('email_id'),
                'success': email_result.get('success', False),
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as log_err:
            logger.warning(f"Failed to write activity log for certificate notification: {str(log_err)}")

        if email_result.get('success'):
            logger.info(f"Certificate notification email sent to {user_email} for {event_title}")
            return {
                'success': True,
                'message': 'Certificate notification sent successfully',
                'emailId': email_result.get('email_id')
            }
        else:
            logger.error(f"Failed to send certificate notification to {user_email}: {email_result.get('message')}")
            return {
                'success': False,
                'message': f"Failed to send certificate notification: {email_result.get('message')}"
            }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in sendCertificateNotification: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error sending certificate notification"
        )


@https_fn.on_call()
def sendEventReminder(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send event reminder email using Resend.
    """
    try:
        data: Dict[str, Any] = req.data or {}
        user_email = data.get('userEmail')
        user_name = data.get('userName', 'Attendee')
        event_title = data.get('eventTitle')
        event_date = data.get('eventDate')
        event_location = data.get('eventLocation')
        registration_id = data.get('registrationId')
        reminder_type = data.get('reminderType', '24h')  # '24h' or '1h'

        if not user_email or not event_title or not event_date:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="userEmail, eventTitle, and eventDate are required"
            )

        # Send email using Resend
        email_result = email_service.send_event_reminder(
            user_email=user_email,
            user_name=user_name,
            event_title=event_title,
            event_date=event_date,
            event_location=event_location or 'TBD',
            registration_id=registration_id or 'unknown',
            reminder_type=reminder_type
        )

        # Log activity for traceability
        try:
            # Get eventId from registration
            event_id = None
            try:
                if registration_id:
                    reg_ref = get_db().collection('registrations').document(registration_id)
                    reg_doc = reg_ref.get()
                    if reg_doc.exists:
                        event_id = reg_doc.to_dict().get('eventId')
            except Exception:
                pass
            
            get_db().collection('activity_logs').add({
                'type': 'event_reminder_sent',
                'eventId': event_id,
                'userEmail': user_email,
                'userName': user_name,
                'eventTitle': event_title,
                'eventDate': event_date,
                'eventLocation': event_location,
                'registrationId': registration_id,
                'reminderType': reminder_type,
                'emailId': email_result.get('email_id'),
                'success': email_result.get('success', False),
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as log_err:
            logger.warning(f"Failed to write activity log for event reminder: {str(log_err)}")

        if email_result.get('success'):
            logger.info(f"Event reminder email sent to {user_email} for {event_title} ({reminder_type})")
            return {
                'success': True,
                'message': 'Event reminder sent successfully',
                'emailId': email_result.get('email_id')
            }
        else:
            logger.error(f"Failed to send event reminder to {user_email}: {email_result.get('message')}")
            return {
                'success': False,
                'message': f"Failed to send event reminder: {email_result.get('message')}"
            }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in sendEventReminder: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error sending event reminder"
        )


def generate_feedback_url(event_id: str, registration_id: str = None, user_email: str = None, user_name: str = None) -> str:
    """
    Generate systematic feedback URL with optional parameters
    """
    base_url = "https://gdgdavao.org"  # Production URL
    feedback_url = f"{base_url}/feedback/{event_id}"
    
    # Add query parameters for better UX
    params = []
    if registration_id:
        params.append(f"registrationId={registration_id}")
    if user_email:
        params.append(f"email={user_email}")
    if user_name:
        params.append(f"name={user_name}")
    
    if params:
        feedback_url += "?" + "&".join(params)
    
    return feedback_url


def send_feedback_requests_for_event(event_id: str, event_title: str) -> None:
    """
    Send feedback request emails to all checked-in or confirmed attendees for a completed event.
    """
    try:
        db = get_db()
        
        # Query registrations for checked-in or confirmed attendees who haven't submitted feedback
        # Note: Firestore doesn't support 'in' queries directly, so we'll query separately
        checked_in_query = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('attendanceStatus', '==', 'checked_in')
        ).where(
            filter=FieldFilter('feedbackSubmitted', '==', False)
        ).stream()
        
        confirmed_query = db.collection('registrations').where(
            filter=FieldFilter('eventId', '==', event_id)
        ).where(
            filter=FieldFilter('attendanceStatus', '==', 'confirmed')
        ).where(
            filter=FieldFilter('feedbackSubmitted', '==', False)
        ).stream()
        
        # Combine results (avoid duplicates)
        registration_ids_seen = set()
        registrations_to_process = []
        
        for reg in checked_in_query:
            reg_id = reg.id
            if reg_id not in registration_ids_seen:
                registration_ids_seen.add(reg_id)
                registrations_to_process.append(reg)
        
        for reg in confirmed_query:
            reg_id = reg.id
            if reg_id not in registration_ids_seen:
                registration_ids_seen.add(reg_id)
                registrations_to_process.append(reg)
        
        logger.info(f"Found {len(registrations_to_process)} registrations to send feedback requests for event {event_id}")
        
        # Process each registration
        for reg in registrations_to_process:
            reg_data = reg.to_dict()
            reg_id = reg.id
            
            # Skip if already sent
            if reg_data.get('feedbackRequestSent', False):
                continue
            
            # Get user details
            user_details = reg_data.get('userDetails', {})
            user_email = user_details.get('email')
            user_name = user_details.get('name', 'Attendee')
            
            if not user_email:
                logger.warning(f"Skipping registration {reg_id}: no email address")
                continue
            
            try:
                # Generate feedback URL
                feedback_url = generate_feedback_url(
                    event_id=event_id,
                    registration_id=reg_id,
                    user_email=user_email,
                    user_name=user_name
                )
                
                # Send feedback request email
                email_result = email_service.send_feedback_request(
                    user_email=user_email,
                    user_name=user_name,
                    event_title=event_title,
                    feedback_url=feedback_url,
                    registration_id=reg_id
                )
                
                # Log activity
                try:
                    db.collection('activity_logs').add({
                        'type': 'feedback_request_sent',
                        'eventId': event_id,
                        'userEmail': user_email,
                        'userName': user_name,
                        'eventTitle': event_title,
                        'feedbackUrl': feedback_url,
                        'registrationId': reg_id,
                        'emailId': email_result.get('email_id'),
                        'success': email_result.get('success', False),
                        'timestamp': firestore.SERVER_TIMESTAMP
                    })
                except Exception as log_err:
                    logger.warning(f"Failed to write activity log for feedback request: {str(log_err)}")
                
                # Update registration based on result
                if email_result.get('success'):
                    update_data = {
                        'feedbackRequestSent': True,
                        'feedbackRequestSentAt': firestore.SERVER_TIMESTAMP,
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    }
                    # Remove error field if it exists
                    if 'feedbackRequestError' in reg_data:
                        update_data['feedbackRequestError'] = firestore.DELETE_FIELD
                    reg.reference.update(update_data)
                    logger.info(f"Feedback request sent successfully to {user_email} for event {event_id}")
                else:
                    reg.reference.update({
                        'feedbackRequestError': email_result.get('message', 'Unknown error'),
                        'feedbackRequestLastAttemptAt': firestore.SERVER_TIMESTAMP,
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    })
                    logger.warning(f"Failed to send feedback request to {user_email}: {email_result.get('message')}")
                    
            except Exception as reg_err:
                logger.error(f"Error processing registration {reg_id} for feedback request: {str(reg_err)}")
                # Mark with error but continue processing others
                try:
                    reg.reference.update({
                        'feedbackRequestError': f"Processing error: {str(reg_err)}",
                        'feedbackRequestLastAttemptAt': firestore.SERVER_TIMESTAMP,
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    })
                except Exception:
                    pass
        
        # Mark event as having sent feedback requests
        event_ref = db.collection('events').document(event_id)
        event_ref.update({
            'feedbackRequestsSentAt': firestore.SERVER_TIMESTAMP,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Completed sending feedback requests for event {event_id}")
        
    except Exception as e:
        logger.error(f"Error in send_feedback_requests_for_event for event {event_id}: {str(e)}")
        raise


@https_fn.on_call()
def sendFeedbackRequest(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send feedback request email using Resend.
    """
    try:
        data: Dict[str, Any] = req.data or {}
        user_email = data.get('userEmail')
        user_name = data.get('userName', 'Attendee')
        event_title = data.get('eventTitle')
        event_id = data.get('eventId')
        registration_id = data.get('registrationId')
        
        # Support both old and new API - feedbackUrl or generate from eventId
        feedback_url = data.get('feedbackUrl')
        if not feedback_url and event_id:
            feedback_url = generate_feedback_url(
                event_id=event_id,
                registration_id=registration_id,
                user_email=user_email,
                user_name=user_name
            )

        if not user_email or not event_title or not feedback_url:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="userEmail, eventTitle, and either feedbackUrl or eventId are required"
            )

        # Send email using Resend
        email_result = email_service.send_feedback_request(
            user_email=user_email,
            user_name=user_name,
            event_title=event_title,
            feedback_url=feedback_url,
            registration_id=registration_id or 'unknown'
        )

        # Log activity for traceability
        try:
            get_db().collection('activity_logs').add({
                'type': 'feedback_request_sent',
                'eventId': event_id,
                'userEmail': user_email,
                'userName': user_name,
                'eventTitle': event_title,
                'feedbackUrl': feedback_url,
                'registrationId': registration_id,
                'emailId': email_result.get('email_id'),
                'success': email_result.get('success', False),
                'timestamp': firestore.SERVER_TIMESTAMP
            })
        except Exception as log_err:
            logger.warning(f"Failed to write activity log for feedback request: {str(log_err)}")

        if email_result.get('success'):
            logger.info(f"Feedback request email sent to {user_email} for {event_title}")
            return {
                'success': True,
                'message': 'Feedback request sent successfully',
                'emailId': email_result.get('email_id')
            }
        else:
            logger.error(f"Failed to send feedback request to {user_email}: {email_result.get('message')}")
            return {
                'success': False,
                'message': f"Failed to send feedback request: {email_result.get('message')}"
            }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in sendFeedbackRequest: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error sending feedback request"
        )


@https_fn.on_call()
def getResendEmailStatus(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get email status from Resend API
    """
    try:
        data: Dict[str, Any] = req.data or {}
        email_id = data.get('emailId')

        if not email_id:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="emailId is required"
            )

        # Call Resend API to get email status
        try:
            # Get Resend API key from environment
            resend_api_key = os.getenv('RESEND_API_KEY')
            if not resend_api_key:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                    message="Resend API key not configured"
                )
            
            # Make request to Resend API
            response = requests.get(
                f"https://api.resend.com/emails/{email_id}",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                email_data = response.json()
                logger.info(f"Email status retrieved for {email_id}: {email_data.get('last_event')}")
                return {
                    'success': True,
                    'status': {
                        'id': email_data.get('id'),
                        'status': email_data.get('last_event', 'unknown'),
                        'created_at': email_data.get('created_at'),
                        'last_event': email_data.get('last_event'),
                        'to': email_data.get('to', []),
                        'from': email_data.get('from'),
                        'subject': email_data.get('subject')
                    }
                }
            elif response.status_code == 404:
                logger.warning(f"Email {email_id} not found in Resend")
                return {
                    'success': False,
                    'message': 'Email not found'
                }
            else:
                logger.error(f"Resend API error: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'message': f"Failed to fetch email status: {response.text}"
                }
                
        except Exception as api_error:
            logger.error(f"Error calling Resend API: {str(api_error)}")
            return {
                'success': False,
                'message': f"API error: {str(api_error)}"
            }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in getResendEmailStatus: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error fetching email status"
        )


@https_fn.on_call()
def getAllResendEmails(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Fetch all emails from Resend API with their delivery status
    Useful for getting bounced emails directly from Resend
    """
    try:
        # Get Resend API key from environment
        resend_api_key = os.getenv('RESEND_API_KEY')
        if not resend_api_key:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Resend API key not configured"
            )
        
        all_emails = []
        has_more = True
        cursor = None
        
        # Resend API pagination - fetch all emails
        while has_more and len(all_emails) < 1000:  # Safety limit
            try:
                url = "https://api.resend.com/emails"
                params = {}
                if cursor:
                    params['cursor'] = cursor
                
                response = requests.get(
                    url,
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json"
                    },
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    emails = data.get('data', [])
                    all_emails.extend(emails)
                    
                    # Check if there are more pages
                    has_more = data.get('has_more', False)
                    if has_more:
                        cursor = data.get('next_cursor')
                    
                    logger.info(f"Fetched {len(emails)} emails from Resend (total: {len(all_emails)})")
                else:
                    logger.error(f"Resend API error: {response.status_code} - {response.text}")
                    break
                    
            except Exception as page_error:
                logger.error(f"Error fetching page: {str(page_error)}")
                break
        
        # Filter and categorize emails
        bounced_emails = []
        delivered_emails = []
        pending_emails = []
        
        for email in all_emails:
            last_event = email.get('last_event', '').lower()
            email_info = {
                'id': email.get('id'),
                'to': email.get('to', []),
                'from': email.get('from'),
                'subject': email.get('subject'),
                'created_at': email.get('created_at'),
                'last_event': last_event
            }
            
            if last_event in ['bounced', 'bounce']:
                bounced_emails.append(email_info)
            elif last_event in ['delivered', 'delivery']:
                delivered_emails.append(email_info)
            else:
                pending_emails.append(email_info)
        
        logger.info(f"Total emails: {len(all_emails)}, Bounced: {len(bounced_emails)}, Delivered: {len(delivered_emails)}, Pending: {len(pending_emails)}")
        
        return {
            'success': True,
            'total': len(all_emails),
            'bounced_count': len(bounced_emails),
            'delivered_count': len(delivered_emails),
            'pending_count': len(pending_emails),
            'bounced_emails': bounced_emails,
            'delivered_emails': delivered_emails,
            'pending_emails': pending_emails
        }
        
    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in getAllResendEmails: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error fetching all emails from Resend"
        )


@https_fn.on_call()
def sendCheckInNotification(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Send check-in confirmation notification email using Resend.
    """
    try:
        data: Dict[str, Any] = req.data or {}
        registration_id = data.get('registrationId')
        event_id = data.get('eventId')
        user_email = data.get('userEmail')
        user_name = data.get('userName', 'Attendee')

        if not registration_id or not event_id or not user_email:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="registrationId, eventId, and userEmail are required"
            )

        # Get event details for email content
        try:
            event_ref = get_db().collection('events').document(event_id)
            event_doc = event_ref.get()
            
            if not event_doc.exists:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.NOT_FOUND,
                    message="Event not found"
                )
            
            event_data = event_doc.to_dict()
            event_title = event_data.get('title', 'Event')
            event_date = event_data.get('date', 'TBD')
            event_location = event_data.get('location', 'TBD')

            # Send email using Resend (using event reminder template as base)
            email_result = email_service.send_event_reminder(
                user_email=user_email,
                user_name=user_name,
                event_title=event_title,
                event_date=event_date,
                event_location=event_location,
                registration_id=registration_id,
                reminder_type="checked_in"  # Custom type for check-in
            )

            # Log activity for traceability
            try:
                get_db().collection('activity_logs').add({
                    'type': 'checkin_notification_sent',
                    'registrationId': registration_id,
                    'eventId': event_id,
                    'userEmail': user_email,
                    'userName': user_name,
                    'emailId': email_result.get('email_id'),
                    'success': email_result.get('success', False),
                    'timestamp': firestore.SERVER_TIMESTAMP
                })
            except Exception as log_err:
                logger.warning(f"Failed to write activity log for check-in notification: {str(log_err)}")

            if email_result.get('success'):
                logger.info(f"Check-in notification email sent to {user_email} (registration {registration_id})")
                return {
                    'success': True,
                    'message': 'Check-in notification sent successfully',
                    'registrationId': registration_id,
                    'eventId': event_id,
                    'emailId': email_result.get('email_id')
                }
            else:
                logger.error(f"Failed to send check-in notification to {user_email}: {email_result.get('message')}")
                return {
                    'success': False,
                    'message': f"Failed to send check-in notification: {email_result.get('message')}",
                    'registrationId': registration_id,
                    'eventId': event_id
                }

        except https_fn.HttpsError:
            raise
        except Exception as event_err:
            logger.error(f"Error getting event details for check-in notification: {str(event_err)}")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message="Internal server error getting event details"
            )

    except https_fn.HttpsError:
        raise
    except Exception as e:
        logger.error(f"Error in sendCheckInNotification: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error sending check-in notification"
        )


# Firestore Triggers

@firestore_fn.on_document_created(document="events/{eventId}")
def on_event_created(event: firestore_fn.Event[firestore_fn.DocumentSnapshot]) -> None:
    """
    Triggered when a new event is created
    """
    try:
        # Handle potential timestamp parsing issues
        if not event.data or not event.data.exists:
            logger.warning("Event data is empty or doesn't exist")
            return
            
        event_id = event.params['eventId']
        event_data = event.data.to_dict()
        
        logger.info(f"Event created: {event_id}")
        
        # Update organizer stats
        organizer_uid = event_data.get('organizer', {}).get('uid')
        if organizer_uid:
            organizer_ref = get_db().collection('users').document(organizer_uid)
            organizer_doc = organizer_ref.get()
            
            if organizer_doc.exists:
                organizer_data = organizer_doc.to_dict()
                current_events = organizer_data.get('eventsCreated', 0)
                organizer_ref.update({
                    'eventsCreated': current_events + 1,
                    'lastEventCreated': firestore.SERVER_TIMESTAMP
                })
        
        # Log event creation for analytics
        get_db().collection('activity_logs').add({
            'type': 'event_created',
            'eventId': event_id,
            'userId': organizer_uid,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'eventTitle': event_data.get('title', 'Unknown')
        })
        
    except ValueError as e:
        # Handle timestamp parsing errors specifically
        if "already exists" in str(e):
            logger.error(f"Firebase initialization error in event created trigger: {str(e)}")
        else:
            logger.error(f"Timestamp parsing error in event created trigger: {str(e)}")
    except Exception as e:
        logger.error(f"Error in event created trigger: {str(e)}")


@firestore_fn.on_document_updated(document="events/{eventId}")
def on_event_updated(event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]) -> None:
    """
    Triggered when an event is updated
    """
    try:
        # Handle potential timestamp parsing issues
        if not event.data or not event.data.after or not event.data.after.exists:
            logger.warning("Event update data is empty or doesn't exist")
            return
            
        event_id = event.params['eventId']
        before_data = event.data.before.to_dict() if event.data.before else {}
        after_data = event.data.after.to_dict() if event.data.after else {}
        
        # Check if event was published
        was_published = before_data.get('isPublished', False)
        is_published = after_data.get('isPublished', False)
        
        if not was_published and is_published:
            logger.info(f"Event {event_id} was published")
            
            # Log event publication
            get_db().collection('activity_logs').add({
                'type': 'event_published',
                'eventId': event_id,
                'userId': after_data.get('organizer', {}).get('uid'),
                'timestamp': firestore.SERVER_TIMESTAMP,
                'eventTitle': after_data.get('title', 'Unknown')
            })
        
        # Check if event status changed to 'completed'
        before_status = before_data.get('status')
        after_status = after_data.get('status')
        
        if before_status != 'completed' and after_status == 'completed':
            logger.info(f"Event {event_id} status changed to completed")
            
            # Skip if feedback requests already sent
            if after_data.get('feedbackRequestsSentAt'):
                logger.info(f"Feedback requests already sent for event {event_id}")
                return
            
            # Send feedback requests to checked-in/confirmed attendees
            try:
                send_feedback_requests_for_event(event_id, after_data.get('title', 'Event'))
            except Exception as e:
                logger.error(f"Error sending feedback requests for event {event_id}: {str(e)}")
        
        # Update analytics if attendee count changed
        before_attendees = before_data.get('currentAttendees', 0)
        after_attendees = after_data.get('currentAttendees', 0)
        
        if before_attendees != after_attendees:
            analytics_ref = get_db().collection('event_analytics').document(event_id)
            analytics_ref.update({
                'registrationCount': after_attendees,
                'lastUpdated': firestore.SERVER_TIMESTAMP
            })
        
    except ValueError as e:
        # Handle timestamp parsing errors specifically
        if "already exists" in str(e):
            logger.error(f"Firebase initialization error in event updated trigger: {str(e)}")
        else:
            logger.error(f"Timestamp parsing error in event updated trigger: {str(e)}")
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