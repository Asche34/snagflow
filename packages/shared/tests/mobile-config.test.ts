import { describe, expect, it } from 'vitest';
import {
  mobileConfigResponse,
  publicReportDownloadUrl,
} from '../../../apps/web/src/lib/mobile-config';
import { MobilePublicConfigSchema } from '../src/mobile-connection';
describe('public mobile configuration response', () => {
  it('keeps report download paths and signatures while advertising the phone-reachable backend', () => {
    expect(
      publicReportDownloadUrl(
        'http://127.0.0.1:54321/storage/v1/object/sign/reports/test.pdf?token=opaque',
        {
          NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
          MOBILE_PUBLIC_SUPABASE_URL: 'http://172.20.10.183:54321',
        },
      ),
    ).toBe('http://172.20.10.183:54321/storage/v1/object/sign/reports/test.pdf?token=opaque');
  });
  it('advertises only public allowlisted fields with no-store and anonymous CORS', async () => {
    const response = mobileConfigResponse({
      NEXT_PUBLIC_SUPABASE_URL: 'https://backend.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test_public_key_12345',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.has('Access-Control-Allow-Credentials')).toBe(false);
    expect(await response.json()).toEqual({
      application: 'SnagFlow',
      version: 1,
      supabaseUrl: 'https://backend.supabase.co',
      supabaseAnonKey: 'sb_publishable_test_public_key_12345',
    });
  });
  it('uses the explicit device address and fails closed without echoing invalid keys', async () => {
    const response = mobileConfigResponse({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      MOBILE_PUBLIC_SUPABASE_URL: 'http://172.20.10.183:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test_public_key_12345',
    });
    expect(MobilePublicConfigSchema.parse(await response.json()).supabaseUrl).toBe(
      'http://172.20.10.183:54321',
    );
    const denied = mobileConfigResponse({
      NEXT_PUBLIC_SUPABASE_URL: 'https://backend.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_NEVER_RETURN_THIS_KEY',
    });
    expect(denied.status).toBe(503);
    expect(await denied.text()).not.toContain('NEVER_RETURN');
  });
});
