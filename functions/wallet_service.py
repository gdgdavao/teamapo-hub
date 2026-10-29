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
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
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


def is_valid_https_uri(uri: Any) -> bool:
    """
    Validate that a URI is a well-formed public https:// URL accepted by Google Wallet REST API.
    Rejects data: URIs, http:// URLs, localhost/loopback hosts, and relative paths.
    """
    if not isinstance(uri, str):
        return False
    cleaned = uri.strip()
    if not cleaned.startswith('https://') or len(cleaned) > 2048:
        return False
    try:
        parsed = urlparse(cleaned)
        host = (parsed.hostname or '').lower()
        if parsed.scheme != 'https' or not host:
            return False
        if host in ('localhost', '127.0.0.1', '0.0.0.0', '::1') or host.endswith('.local'):
            return False
        return '.' in host
    except Exception:
        return False


def _resolve_timezone(tz_name: Optional[str]) -> timezone | ZoneInfo:
    """Resolve event timezone with safe fallback to Asia/Manila (UTC+8)."""
    target = (tz_name or 'Asia/Manila').strip() or 'Asia/Manila'
    try:
        return ZoneInfo(target)
    except (ZoneInfoNotFoundError, Exception):
        try:
            return ZoneInfo('Asia/Manila')
        except Exception:
            return timezone(timedelta(hours=8))


def format_datetime_iso(dt_val: Any, timezone_name: str = 'Asia/Manila') -> Optional[str]:
    """Format datetime/timestamp value into RFC 3339 / ISO-8601 string in the event's timezone."""
    if not dt_val:
        return None
    tz = _resolve_timezone(timezone_name)
    try:
        dt_obj: Optional[datetime] = None

        if isinstance(dt_val, datetime):
            dt_obj = dt_val
        elif hasattr(dt_val, 'to_datetime'):
            dt_obj = dt_val.to_datetime()
        elif hasattr(dt_val, 'seconds') and isinstance(getattr(dt_val, 'seconds'), (int, float)):
            dt_obj = datetime.fromtimestamp(float(getattr(dt_val, 'seconds')), tz=timezone.utc)
        elif isinstance(dt_val, dict):
            raw_sec = dt_val.get('seconds') if 'seconds' in dt_val else dt_val.get('_seconds')
            if isinstance(raw_sec, (int, float)):
                dt_obj = datetime.fromtimestamp(float(raw_sec), tz=timezone.utc)
        elif isinstance(dt_val, (int, float)):
            sec = float(dt_val) / 1000.0 if float(dt_val) >= 1e11 else float(dt_val)
            dt_obj = datetime.fromtimestamp(sec, tz=timezone.utc)
        elif isinstance(dt_val, str):
            cleaned = dt_val.strip()
            if not cleaned:
                return None
            try:
                dt_obj = datetime.fromisoformat(cleaned.replace('Z', '+00:00'))
            except ValueError:
                return cleaned

        if dt_obj is not None:
            if dt_obj.tzinfo is None:
                dt_obj = dt_obj.replace(tzinfo=tz)
            else:
                dt_obj = dt_obj.astimezone(tz)
            return dt_obj.isoformat()
    except Exception:
        pass
    return None


def _resolve_wallet_venue(event_data: Dict[str, Any]) -> Tuple[str, str]:
    """Safely extract non-empty (venue_name, venue_address) for Google Wallet EventVenue."""
    default_name = 'Davao City, Philippines'
    default_address = 'Davao City, Philippines'

    if event_data.get('locationTba'):
        return 'Location TBA', default_address

    raw_venue = event_data.get('venue')
    if isinstance(raw_venue, str):
        cleaned = raw_venue.strip()
        return (cleaned or default_name, cleaned or default_address)

    if isinstance(raw_venue, dict):
        if raw_venue.get('type') == 'online':
            return 'Online Event', 'Online'
        name = (raw_venue.get('name') or '').strip()
        address = (raw_venue.get('address') or '').strip()
        city = (raw_venue.get('city') or '').strip()

        if name and address:
            name_lower = name.lower()
            while address.lower().startswith(name_lower):
                address = re.sub(r'^[\s,;-]+', '', address[len(name):]).strip()

        resolved_name = name or address or city or default_name
        addr_parts = [p for p in (address, city) if p and (not address or p == address or p.lower() not in address.lower())]
        resolved_address = ', '.join(dict.fromkeys(addr_parts)) if addr_parts else (name or default_address)
        return resolved_name, resolved_address

    return default_name, default_address


def build_event_ticket_class(
    issuer_id: str,
    event_id: str,
    event_data: Dict[str, Any],
    app_url: str = 'https://apohub.gdgdavao.org',
    registration_id: Optional[str] = None
) -> Dict[str, Any]:
    """Construct standard EventTicketClass payload."""
    class_id = get_class_id(issuer_id, event_id)
    raw_title = event_data.get('title')
    title = raw_title.strip() if isinstance(raw_title, str) and raw_title.strip() else 'Google Developer Groups - Davao Event'
    venue_name, venue_address = _resolve_wallet_venue(event_data)

    tz_name = event_data.get('timezone') if isinstance(event_data.get('timezone'), str) else 'Asia/Manila'
    start_iso = format_datetime_iso(event_data.get('startDate') or event_data.get('startAt'), tz_name)
    end_iso = format_datetime_iso(event_data.get('endDate') or event_data.get('endAt'), tz_name)

    # Use the event's banner or promo image if available and a valid public https:// URI; omit hero otherwise
    raw_hero = event_data.get('bannerUrl') or event_data.get('imageUrl')
    hero_url = raw_hero.strip() if is_valid_https_uri(raw_hero) else None

    default_logo = 'https://assets.gdgdavao.org/gdg-logo.png'
    env_logo = os.getenv('WALLET_LOGO_URL', default_logo)
    logo_url = env_logo.strip() if is_valid_https_uri(env_logo) else default_logo

    class_payload: Dict[str, Any] = {
        'id': class_id,
        'issuerName': 'Google Developer Groups - Davao',
        'eventName': {'defaultValue': {'language': 'en-US', 'value': title}},
        'reviewStatus': 'UNDER_REVIEW',
        'hexBackgroundColor': '#0b57d0',  # GDG blue primary token
        'venue': {
            'name': {'defaultValue': {'language': 'en-US', 'value': venue_name}},
            'address': {'defaultValue': {'language': 'en-US', 'value': venue_address}}
        },
        'logo': {
            'sourceUri': {'uri': logo_url},
            'contentDescription': {'defaultValue': {'language': 'en-US', 'value': 'Google Developer Groups - Davao Logo'}}
        }
    }

    if hero_url:
        class_payload['heroImage'] = {
            'sourceUri': {'uri': hero_url},
            'contentDescription': {'defaultValue': {'language': 'en-US', 'value': title}}
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
    user_details = registration_data.get('userDetails') if isinstance(registration_data.get('userDetails'), dict) else {}
    raw_name = (
        user_details.get('name')
        or registration_data.get('attendeeName')
        or f"{user_details.get('firstName', '')} {user_details.get('lastName', '')}".strip()
    )
    attendee_name = raw_name.strip() if isinstance(raw_name, str) and raw_name.strip() else 'Attendee'
    raw_qr = registration_data.get('qrCode')
    qr_code = raw_qr.strip() if isinstance(raw_qr, str) and raw_qr.strip() else f"registration:{registration_id}"

    # Determine ticket type name
    ticket_type_id = registration_data.get('ticketTypeId')
    ticket_type_name = 'General Admission'
    ticket_types = event_data.get('ticketTypes') or []
    if isinstance(ticket_types, list):
        for tt in ticket_types:
            if isinstance(tt, dict) and tt.get('id') == ticket_type_id:
                tt_name = tt.get('name')
                if isinstance(tt_name, str) and tt_name.strip():
                    ticket_type_name = tt_name.strip()
                break

    quantity = str(registration_data.get('quantity') or 1)

    text_modules = [
        {'id': 'ticket_type', 'header': 'Ticket Tier', 'body': ticket_type_name},
        {'id': 'quantity', 'header': 'Quantity', 'body': quantity},
        {'id': 'community', 'header': 'Organizer', 'body': 'Google Developer Groups - Davao'}
    ]

    object_payload: Dict[str, Any] = {
        'id': object_id,
        'classId': class_id,
        'state': 'ACTIVE',
        'ticketHolderName': attendee_name,
        'ticketNumber': sanitize_identifier(registration_id)[:8].upper(),
        'barcode': {
            'type': 'QR_CODE',
            'value': qr_code,
            'alternateText': ''
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


def patch_wallet_object(
    issuer_id: str,
    registration_id: str,
    patch_data: Dict[str, Any],
    service_account_info: Dict[str, Any],
    upsert: bool = False,
    session: Optional[requests.Session] = None
) -> bool:
    """Patch (or insert on 404 when upsert=True) eventTicketObject payload in the Wallet API."""
    object_id = get_object_id(issuer_id, registration_id)
    url = f"{WALLET_API_BASE}/eventTicketObject/{object_id}"
    try:
        active_session = session or get_authorized_session(service_account_info)
        res = active_session.patch(url, json=patch_data, timeout=10)
        if res.status_code in (200, 204):
            logger.info(f"Patched object {object_id}")
            return True
        elif res.status_code == 404:
            if upsert:
                insert_url = f"{WALLET_API_BASE}/eventTicketObject"
                ins_res = active_session.post(insert_url, json=patch_data, timeout=10)
                if ins_res.status_code in (200, 201, 409):
                    logger.info(f"Inserted object {object_id} (status {ins_res.status_code})")
                    return True
                logger.warning(f"Wallet API insert object failed: {ins_res.status_code} {ins_res.text}")
                return False
            logger.info(f"Object {object_id} not found in Wallet API (upsert will happen on next Save)")
            return False
        else:
            logger.warning(f"Wallet API patch object failed: {res.status_code} {res.text}")
            return False
    except Exception as e:
        logger.error(f"Error patching wallet object {object_id}: {str(e)}")
        return False


def patch_wallet_object_state(
    issuer_id: str,
    registration_id: str,
    state: str,  # 'ACTIVE' | 'INACTIVE' | 'COMPLETED'
    service_account_info: Dict[str, Any]
) -> bool:
    """Patch object state in the Wallet API (e.g. INACTIVE on cancellation)."""
    return patch_wallet_object(
        issuer_id=issuer_id,
        registration_id=registration_id,
        patch_data={'state': state},
        service_account_info=service_account_info
    )


def patch_wallet_class(
    issuer_id: str,
    event_id: str,
    patch_data: Dict[str, Any],
    service_account_info: Dict[str, Any],
    upsert: bool = False,
    session: Optional[requests.Session] = None
) -> bool:
    """Patch (or insert on 404 when upsert=True) event class in the Wallet API."""
    class_id = get_class_id(issuer_id, event_id)
    url = f"{WALLET_API_BASE}/eventTicketClass/{class_id}"
    try:
        active_session = session or get_authorized_session(service_account_info)
        res = active_session.patch(url, json=patch_data, timeout=10)
        if res.status_code in (200, 204):
            logger.info(f"Patched class {class_id}")
            return True
        elif res.status_code == 404:
            if upsert:
                insert_url = f"{WALLET_API_BASE}/eventTicketClass"
                ins_res = active_session.post(insert_url, json=patch_data, timeout=10)
                if ins_res.status_code in (200, 201, 409):
                    logger.info(f"Inserted class {class_id} (status {ins_res.status_code})")
                    return True
                logger.warning(f"Wallet API insert class failed: {ins_res.status_code} {ins_res.text}")
                return False
            logger.info(f"Class {class_id} not found in Wallet API (upsert will happen on next Save)")
            return False
        else:
            logger.warning(f"Wallet API patch class failed: {res.status_code} {res.text}")
            return False
    except Exception as e:
        logger.error(f"Error patching wallet class {class_id}: {str(e)}")
        return False
