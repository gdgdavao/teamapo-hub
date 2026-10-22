import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { calculateTicketPricing } from '@/utils/pricing';
import type { TicketType, ValidatedPromoDiscount } from '@/types';

const ROOT = process.cwd();

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf8');
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

describe('Security Remediation: Promo Code Isolation & Bundle Hardening (VULN-01..04)', () => {
  describe('VULN-01 & VULN-02: Firestore Rules & Subcollection Isolation', () => {
    const rules = read('firestore.rules');
    const eventService = read('src', 'services', 'eventService.ts');
    const regForm = read('src', 'pages', 'registration', 'components', 'RegistrationForm.tsx');

    it('enforces hasNoPublicPromoCodes on /events/{eventId} and locks /promocodes/{codeId}', () => {
      expect(rules).toContain('function hasNoPublicPromoCodes(data)');
      expect(rules).toContain('match /promocodes/{codeId}');
      expect(rules).toContain('allow read, write: if false;');

      const eventsBlock = rules.slice(
        rules.indexOf('match /events/{eventId}'),
        rules.indexOf('match /promocodes/{codeId}')
      );
      expect(eventsBlock).toContain('hasNoPublicPromoCodes(request.resource.data)');
      expect(eventsBlock).toContain('match /config/{configId}');
      expect(eventsBlock).toContain('allow read: if canManageEvent(eventId);');
    });

    it('persists promo codes in events/{eventId}/config/promoCodes and sets hasPromoCodes on public event doc', () => {
      expect(eventService).toContain("'config', 'promoCodes'");
      expect(eventService).toContain('hasPromoCodes:');
      expect(eventService).toContain('promoCodes: deleteField()');
      expect(eventService).toContain('static async getEventPromoCodes(');
      expect(eventService).toContain('static async validatePromoCodeRemote(');
    });

    it('never passes raw event.promoCodes array into TicketSelector from RegistrationForm', () => {
      expect(regForm).not.toContain('promoCodes={event.promoCodes');
      expect(regForm).toContain('eventId={event.id}');
      expect(regForm).toContain('hasPromoCodes={Boolean(event.hasPromoCodes');
    });
  });

  describe('Server-Side Promo Code Validation & Transactional Enforcement', () => {
    const mainPy = read('functions', 'main.py');

    it('exposes validatePromoCode callable returning minimal discount metadata', () => {
      expect(mainPy).toContain('def validatePromoCode(req: https_fn.CallableRequest)');
      expect(mainPy).toContain('def validate_promo_code(req: https_fn.CallableRequest)');
      expect(mainPy).toContain('def _load_event_promo_codes(');
      expect(mainPy).toContain('def _evaluate_promo_code(');
    });

    it('validates promo codes and increments currentUses inside createAnonymousRegistration transaction', () => {
      const fnStart = mainPy.indexOf('def createAnonymousRegistration');
      const nextFn = mainPy.indexOf('\n@https_fn', fnStart + 1);
      const createAnonBody = mainPy.slice(fnStart, nextFn === -1 ? undefined : nextFn);

      expect(createAnonBody).toContain('promo_codes, promo_config_ref, from_config = _load_event_promo_codes(db, event_id, event, tx=tx)');
      expect(createAnonBody).toContain('eval_res = _evaluate_promo_code(promo_codes, raw_promo_code, ticket)');
      expect(createAnonBody).toContain('tx.set(promo_config_ref, {');
      expect(createAnonBody).toContain("event_update['promoCodes'] = firestore.DELETE_FIELD");
    });

    it('computes TicketPricing accurately from ValidatedPromoDiscount without full PromoCode record', () => {
      const ticketType: TicketType = {
        id: 'vip',
        name: 'VIP Ticket',
        description: 'VIP access',
        price: 1000,
        currency: 'PHP',
        currentSold: 0,
        isActive: true,
        sortOrder: 0,
      };

      const percentagePromo: ValidatedPromoDiscount = {
        code: 'DISCOUNT20',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscountAmount: 150,
      };

      const calc = calculateTicketPricing({
        ticketType,
        quantity: 1,
        promoCode: percentagePromo,
      });

      expect(calc.promoApplied).toBe(true);
      expect(calc.discountAmount).toBe(150); // Capped by maxDiscountAmount
      expect(calc.totalAmount).toBe(850);
    });
  });

  describe('VULN-03 & VULN-04: Vite Build & Console Hardening', () => {
    it('configures vite.config.js with sourcemap: false and production console/debugger dropping', () => {
      const viteConfig = read('vite.config.js');
      expect(viteConfig).toContain('sourcemap: false');
      expect(viteConfig).toContain("drop: mode === 'production' ? ['console', 'debugger'] : []");
    });

    it('provides a safe .env.example with no private secrets', () => {
      expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
      const envExample = read('.env.example');
      expect(envExample).toContain('VITE_FIREBASE_API_KEY=');
      expect(envExample).not.toContain('RESEND_API_KEY=re_');
    });

    it('contains no raw console.* calls in src/ outside src/utils/logger.ts', () => {
      const srcFiles = collectFiles(join(ROOT, 'src'));
      const offenders: string[] = [];

      for (const file of srcFiles) {
        if (file.endsWith(join('src', 'utils', 'logger.ts'))) continue;
        const content = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/[^\n]*/g, '');
        if (/\bconsole\.(log|warn|error|info|debug|group|groupCollapsed|groupEnd|table)\s*\(/.test(content)) {
          offenders.push(file.replace(ROOT + '/', ''));
        }
      }

      expect(offenders).toEqual([]);
    });
  });
});
