"""
Google Wallet Service for TeamApo Hub
Handles EventTicket class & object generation, Save-link JWT signing, and lifecycle sync.
"""
import os
import re
import json
import time
import logging
import hashlib
from typing import Dict, Any, Optional, Tuple, List
import jwt
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

logger = logging.getLogger('wallet_service')

WALLET_SCOPES = ['https://www.googleapis.com/auth/wallet_object.issuer']
WALLET_API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1'

PASS_ARTWORK_URLS: List[str] = [
    'https://assets.gdgdavao.org/passes-assets/apo.png',
    'https://assets.gdgdavao.org/passes-assets/cacao.png',
    'https://assets.gdgdavao.org/passes-assets/dahican.png',
    'https://assets.gdgdavao.org/passes-assets/durian.png',
    'https://assets.gdgdavao.org/passes-assets/eagle.png',
    'https://assets.gdgdavao.org/passes-assets/eden.png',
    'https://assets.gdgdavao.org/passes-assets/gulf.png',
    'https://assets.gdgdavao.org/passes-assets/samal.png',
    'https://assets.gdgdavao.org/passes-assets/sanped.png',
    'https://assets.gdgdavao.org/passes-assets/waling.png',
]


def get_artwork_url(registration_id: str) -> str:
    """
    Deterministically select an artwork URL using SHA-256(registration_id) % 10.
    Identical to selectArtworkIndex in src/utils/passArtwork.ts.
    """
    if not registration_id:
        return PASS_ARTWORK_URLS[0]
    hash_hex = hashlib.sha256(registration_id.strip().encode('utf-8')).hexdigest()
    slice_num = int(hash_hex[:8], 16)
    idx = abs(slice_num) % len(PASS_ARTWORK_URLS)
    return PASS_ARTWORK_URLS[idx]


def sanitize_identifier(raw_id: str) -> str:
    """Fold IDs to safe characters [a-zA-Z0-9_-] for Google Wallet API."""
    if not raw_id:
        return 'unknown'
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '_', raw_id.strip())
    return sanitized.strip('_') or 'unknown'


def get_class_id(issuer_id: str, event_id: str) -> str:
    clean_event = sanitize_identifier(event_id)
    return f"{issuer_id}.gdgDavaoEvent_{clean_event}"


def get_object_id(issuer_id: str, registration_id: str) -> str:
    clean_reg = sanitize_identifier(registration_id)[:16]
    return f"{issuer_id}.reg_{clean_reg}"


def get_wallet_credentials_and_issuer() -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Retrieve WALLET_ISSUER_ID and parsed WALLET_ISSUER_KEY credentials.
    Returns (issuer_id, service_account_info) or (None, None) if not configured.
    """
    issuer_id = os.getenv('WALLET_ISSUER_ID') or os.getenv('WALLET_ISSUER_ID'.lower())
    raw_key = os.getenv('WALLET_ISSUER_KEY')

    if not issuer_id or issuer_id.startswith('<') or not raw_key:
        return None, None

    try:
        if isinstance(raw_key, str) and raw_key.strip().startswith('{'):
            key_data = json.loads(raw_key)
        elif isinstance(raw_key, str) and os.path.isfile(raw_key):
            with open(raw_key, 'r') as f:
                key_data = json.load(f)
        else:
            return None, None

        if not key_data.get('client_email') or not key_data.get('private_key'):
            return None, None

        return issuer_id, key_data
    except Exception as e:
        logger.warning(f"Error parsing WALLET_ISSUER_KEY: {str(e)}")
        return None, None


def format_datetime_iso(dt_val: Any) -> Optional[str]:
    """Format datetime/timestamp value into ISO-8601 string."""
    if not dt_val:
        return None
    try:
        if hasattr(dt_val, 'isoformat'):
            return dt_val.isoformat()
        if hasattr(dt_val, 'to_datetime'):
            return dt_val.to_datetime().isoformat()
        if isinstance(dt_val, str):
            return dt_val
    except Exception:
        pass
    return None


def build_event_ticket_class(
    issuer_id: str,
    event_id: str,
    event_data: Dict[str, Any],
    app_url: str = 'https://apohub.gdgdavao.org',
    registration_id: Optional[str] = None
) -> Dict[str, Any]:
    """Construct standard EventTicketClass payload."""
    class_id = get_class_id(issuer_id, event_id)
    title = event_data.get('title', 'GDG Davao Event')
    venue = event_data.get('venue') or {}
    venue_name = venue.get('name') or (venue.get('address') or 'Davao City, Philippines')
    venue_address = venue.get('address') or venue.get('city') or 'Davao City'

    start_iso = format_datetime_iso(event_data.get('startDate') or event_data.get('startAt'))
    end_iso = format_datetime_iso(event_data.get('endDate') or event_data.get('endAt'))

    hero_url = (
        get_artwork_url(registration_id)
        if registration_id
        else (event_data.get('bannerUrl') or PASS_ARTWORK_URLS[0])
    )

    logo_url = os.getenv(
        'WALLET_LOGO_URL',
        'https://assets.gdgdavao.org/email-assets/gdgdvo-header-mail.png'
    )

    class_payload: Dict[str, Any] = {
        'id': class_id,
        'issuerName': 'GDG Davao',
        'eventName': {'defaultValue': {'language': 'en-US', 'value': title}},
        'reviewStatus': 'UNDER_REVIEW',
        'hexBackgroundColor': '#0b57d0',  # GDG blue primary token
        'venue': {
            'name': {'defaultValue': {'language': 'en-US', 'value': venue_name}},
            'address': {'defaultValue': {'language': 'en-US', 'value': venue_address}}
        },
        'logo': {
            'sourceUri': {'uri': logo_url},
            'contentDescription': {'defaultValue': {'language': 'en-US', 'value': 'GDG Davao Logo'}}
        },
        'heroImage': {
            'sourceUri': {'uri': hero_url},
            'contentDescription': {'defaultValue': {'language': 'en-US', 'value': title}}
        }
    }

    date_time_obj: Dict[str, str] = {}
    if start_iso:
        date_time_obj['start'] = start_iso
    if end_iso:
        date_time_obj['end'] = end_iso
    if date_time_obj:
        class_payload['dateTime'] = date_time_obj

    return class_payload


def build_event_ticket_object(
    issuer_id: str,
    class_id: str,
    registration_id: str,
    registration_data: Dict[str, Any],
    event_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Construct standard EventTicketObject payload."""
    object_id = get_object_id(issuer_id, registration_id)
    attendee_name = (
        (registration_data.get('userDetails') or {}).get('name')
        or registration_data.get('attendeeName')
        or 'Attendee'
    )
    qr_code = registration_data.get('qrCode') or f"registration:{registration_id}"

    # Determine ticket type name
    ticket_type_id = registration_data.get('ticketTypeId')
    ticket_type_name = 'General Admission'
    ticket_types = event_data.get('ticketTypes') or []
    for tt in ticket_types:
        if isinstance(tt, dict) and tt.get('id') == ticket_type_id:
            ticket_type_name = tt.get('name', ticket_type_name)
            break

    quantity = str(registration_data.get('quantity', 1))

    text_modules = [
        {'id': 'ticket_type', 'header': 'Ticket Tier', 'body': ticket_type_name},
        {'id': 'quantity', 'header': 'Quantity', 'body': quantity},
        {'id': 'community', 'header': 'Organizer', 'body': 'GDG Davao'}
    ]

    object_payload: Dict[str, Any] = {
        'id': object_id,
        'classId': class_id,
        'state': 'ACTIVE',
        'ticketHolderName': attendee_name,
        'ticketNumber': registration_id[:8].upper(),
        'barcode': {
            'type': 'QR_CODE',
            'value': qr_code,
            'alternateText': qr_code
        },
        'textModulesData': text_modules
    }

    return object_payload


def generate_save_jwt(
    service_account_info: Dict[str, Any],
    class_payload: Dict[str, Any],
    object_payload: Dict[str, Any],
    expiry_seconds: int = 900
) -> str:
    """Generate and sign a Save-to-Wallet JWT using RS256."""
    client_email = service_account_info.get('client_email')
    private_key = service_account_info.get('private_key')
    now = int(time.time())

    claims = {
        'iss': client_email,
        'aud': 'google',
        'typ': 'savetowallet',
        'iat': now,
        'exp': now + expiry_seconds,
        'payload': {
            'eventTicketClasses': [class_payload],
            'eventTicketObjects': [object_payload]
        }
    }

    return jwt.encode(claims, private_key, algorithm='RS256')


def get_authorized_session(service_account_info: Dict[str, Any]) -> requests.Session:
    """Build an authorized HTTP session for Google Wallet REST API calls."""
    credentials = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=WALLET_SCOPES
    )
    credentials.refresh(Request())
    session = requests.Session()
    session.headers.update({
        'Authorization': f"Bearer {credentials.token}",
        'Content-Type': 'application/json'
    })
    return session


def patch_wallet_object_state(
    issuer_id: str,
    registration_id: str,
    state: str,  # 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
    service_account_info: Dict[str, Any]
) -> bool:
    """Patch object state in the Wallet API (e.g. INACTIVE on cancellation)."""
    object_id = get_object_id(issuer_id, registration_id)
    url = f"{WALLET_API_BASE}/eventTicketObject/{object_id}"
    try:
        session = get_authorized_session(service_account_info)
        res = session.patch(url, json={'state': state}, timeout=10)
        if res.status_code in (200, 204):
            logger.info(f"Patched object {object_id} state to {state}")
            return True
        elif res.status_code == 404:
            logger.info(f"Object {object_id} not found in Wallet API (safe to ignore on deactivate)")
            return False
        else:
            logger.warning(f"Wallet API patch object failed: {res.status_code} {res.text}")
            return False
    except Exception as e:
        logger.error(f"Error patching wallet object {object_id}: {str(e)}")
        return False


def patch_wallet_class(
    issuer_id: str,
    event_id: str,
    patch_data: Dict[str, Any],
    service_account_info: Dict[str, Any]
) -> bool:
    """Patch event class in the Wallet API when title, dates, or venue change."""
    class_id = get_class_id(issuer_id, event_id)
    url = f"{WALLET_API_BASE}/eventTicketClass/{class_id}"
    try:
        session = get_authorized_session(service_account_info)
        res = session.patch(url, json=patch_data, timeout=10)
        if res.status_code in (200, 204):
            logger.info(f"Patched class {class_id}")
            return True
        elif res.status_code == 404:
            logger.info(f"Class {class_id} not found in Wallet API (upsert will happen on next Save)")
            return False
        else:
            logger.warning(f"Wallet API patch class failed: {res.status_code} {res.text}")
            return False
    except Exception as e:
        logger.error(f"Error patching wallet class {class_id}: {str(e)}")
        return False
