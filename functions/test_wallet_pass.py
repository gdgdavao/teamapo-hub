"""
Unit tests for Google Wallet Service in Python
"""
import unittest
from datetime import datetime
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import jwt

import wallet_service


class TestWalletService(unittest.TestCase):
    def test_sanitize_identifier(self):
        self.assertEqual(wallet_service.sanitize_identifier('event/2026:Davao Special!'), 'event_2026_Davao_Special')
        self.assertEqual(wallet_service.sanitize_identifier('normal-id_123'), 'normal-id_123')
        self.assertEqual(wallet_service.sanitize_identifier(''), 'unknown')
        self.assertEqual(wallet_service.sanitize_identifier('  _leading_trailing_  '), 'leading_trailing')

    def test_class_and_object_ids(self):
        class_id = wallet_service.get_class_id('ISSUER123', 'evt-davao-2026')
        self.assertEqual(class_id, 'ISSUER123.gdgDavaoEvent_evt-davao-2026')

        object_id = wallet_service.get_object_id('ISSUER123', 'reg-abcdef1234567890')
        self.assertEqual(object_id, 'ISSUER123.reg_reg-abcdef123456')

    def test_get_artwork_url(self):
        url1 = wallet_service.get_artwork_url('reg-12345')
        url2 = wallet_service.get_artwork_url('reg-12345')
        self.assertEqual(url1, url2)
        self.assertTrue(url1.startswith('https://assets.gdgdavao.org/passes-assets/'))

    def test_build_event_ticket_class(self):
        event_data = {
            'title': 'GDG DevFest Davao 2026',
            'startDate': datetime(2026, 11, 15, 9, 0, 0),
            'endDate': datetime(2026, 11, 15, 17, 0, 0),
            'venue': {
                'name': 'SMX Convention Center Davao',
                'address': 'Lanang, Davao City'
            },
            'bannerUrl': 'https://storage.googleapis.com/test-bucket/banner.jpg'
        }
        cls = wallet_service.build_event_ticket_class(
            issuer_id='ISSUER123',
            event_id='evt-devfest',
            event_data=event_data,
            app_url='https://apohub.gdgdavao.org'
        )

        self.assertEqual(cls['id'], 'ISSUER123.gdgDavaoEvent_evt-devfest')
        self.assertEqual(cls['issuerName'], 'Google Developer Groups - Davao')
        self.assertEqual(cls['hexBackgroundColor'], '#0b57d0')
        self.assertEqual(cls['eventName']['defaultValue']['value'], 'GDG DevFest Davao 2026')
        self.assertEqual(cls['venue']['name']['defaultValue']['value'], 'SMX Convention Center Davao')
        self.assertEqual(cls['logo']['sourceUri']['uri'], 'https://assets.gdgdavao.org/gdg-logo.png')
        self.assertEqual(cls['heroImage']['sourceUri']['uri'], 'https://storage.googleapis.com/test-bucket/banner.jpg')
        self.assertIn('start', cls['dateTime'])

        # Test class without bannerUrl / imageUrl: heroImage should be omitted
        cls_no_hero = wallet_service.build_event_ticket_class(
            issuer_id='ISSUER123',
            event_id='evt-devfest-nobanner',
            event_data={'title': 'Community Meetup'},
            app_url='https://apohub.gdgdavao.org'
        )
        self.assertNotIn('heroImage', cls_no_hero)

    def test_build_event_ticket_class_edge_cases(self):
        # 1. String venue and non-HTTPS bannerUrl (data: or http://) must not crash or include invalid heroImage
        cls_str_venue = wallet_service.build_event_ticket_class(
            issuer_id='ISSUER123',
            event_id='evt-str-venue',
            event_data={
                'title': '   ',
                'venue': 'Ateneo de Davao University',
                'bannerUrl': 'data:image/png;base64,iVBORw0KGgo=',
                'startDate': {'seconds': 1763168400},
                'timezone': 'Asia/Manila'
            }
        )
        self.assertEqual(cls_str_venue['eventName']['defaultValue']['value'], 'Google Developer Groups - Davao Event')
        self.assertEqual(cls_str_venue['venue']['name']['defaultValue']['value'], 'Ateneo de Davao University')
        self.assertEqual(cls_str_venue['venue']['address']['defaultValue']['value'], 'Ateneo de Davao University')
        self.assertNotIn('heroImage', cls_str_venue)
        self.assertTrue(cls_str_venue['dateTime']['start'].endswith('+08:00'))

        # 2. locationTba = True
        cls_tba = wallet_service.build_event_ticket_class(
            issuer_id='ISSUER123',
            event_id='evt-tba',
            event_data={
                'title': 'Secret Meetup',
                'locationTba': True,
                'bannerUrl': 'http://localhost:5173/banner.png'
            }
        )
        self.assertEqual(cls_tba['venue']['name']['defaultValue']['value'], 'Location TBA')
        self.assertEqual(cls_tba['venue']['address']['defaultValue']['value'], 'Davao City, Philippines')
        self.assertNotIn('heroImage', cls_tba)

        # 3. Online venue
        cls_online = wallet_service.build_event_ticket_class(
            issuer_id='ISSUER123',
            event_id='evt-online',
            event_data={
                'title': 'Online Study Jam',
                'venue': {'type': 'online', 'onlineUrl': 'https://meet.google.com/abc'}
            }
        )
        self.assertEqual(cls_online['venue']['name']['defaultValue']['value'], 'Online Event')
        self.assertEqual(cls_online['venue']['address']['defaultValue']['value'], 'Online')

    def test_is_valid_https_uri(self):
        self.assertTrue(wallet_service.is_valid_https_uri('https://assets.gdgdavao.org/banner.png'))
        self.assertFalse(wallet_service.is_valid_https_uri('http://assets.gdgdavao.org/banner.png'))
        self.assertFalse(wallet_service.is_valid_https_uri('https://localhost:3000/banner.png'))
        self.assertFalse(wallet_service.is_valid_https_uri('data:image/png;base64,abc'))
        self.assertFalse(wallet_service.is_valid_https_uri('/relative/path.png'))
        self.assertFalse(wallet_service.is_valid_https_uri(None))

    def test_build_event_ticket_object(self):
        event_data = {
            'ticketTypes': [{'id': 'tt-vip', 'name': 'VIP Pass'}]
        }
        registration_data = {
            'ticketTypeId': 'tt-vip',
            'quantity': 2,
            'qrCode': 'REG-123456-ABCDEF',
            'userDetails': {'name': 'Juan Dela Cruz'}
        }
        obj = wallet_service.build_event_ticket_object(
            issuer_id='ISSUER123',
            class_id='ISSUER123.gdgDavaoEvent_evt-1',
            registration_id='reg-12345',
            registration_data=registration_data,
            event_data=event_data
        )

        self.assertEqual(obj['id'], 'ISSUER123.reg_reg-12345')
        self.assertEqual(obj['ticketHolderName'], 'Juan Dela Cruz')
        self.assertEqual(obj['barcode']['value'], 'REG-123456-ABCDEF')
        self.assertEqual(obj['barcode']['type'], 'QR_CODE')
        self.assertEqual(obj['barcode']['alternateText'], '')
        self.assertEqual(obj['state'], 'ACTIVE')

        # Check text modules
        organizer_module = next((m for m in obj['textModulesData'] if m['id'] == 'community'), None)
        self.assertIsNotNone(organizer_module)
        self.assertEqual(organizer_module['body'], 'Google Developer Groups - Davao')

    def test_generate_save_jwt_with_rsa(self):
        # Generate temporary RSA key for unit test
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        private_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')

        service_account_info = {
            'client_email': 'test-sa@project.iam.gserviceaccount.com',
            'private_key': private_pem
        }

        class_payload = {'id': 'ISSUER.class1'}
        object_payload = {'id': 'ISSUER.obj1'}

        token = wallet_service.generate_save_jwt(
            service_account_info=service_account_info,
            class_payload=class_payload,
            object_payload=object_payload,
            expiry_seconds=900
        )

        # Verify decoded token matches claims
        public_key = key.public_key()
        decoded = jwt.decode(token, public_key, algorithms=['RS256'], audience='google')
        self.assertEqual(decoded['iss'], 'test-sa@project.iam.gserviceaccount.com')
        self.assertEqual(decoded['aud'], 'google')
        self.assertEqual(decoded['typ'], 'savetowallet')
        self.assertEqual(decoded['payload']['eventTicketClasses'][0]['id'], 'ISSUER.class1')
        self.assertEqual(decoded['payload']['eventTicketObjects'][0]['id'], 'ISSUER.obj1')


if __name__ == '__main__':
    unittest.main()
