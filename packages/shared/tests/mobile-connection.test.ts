import { describe, expect, it } from 'vitest';
import {
  AppUrlSchema,
  MobilePublicConfigSchema,
  MobileConnectionSchema,
} from '../src/mobile-connection';
const key = 'sb_publishable_unit_test_public_key_12345';
const config = {
  application: 'SnagFlow',
  version: 1,
  supabaseUrl: 'https://backend.supabase.co',
  supabaseAnonKey: key,
};
describe('mobile connection public contract', () => {
  it('normalizes deployment origins and allows explicit private development addresses', () => {
    expect(AppUrlSchema.parse(' https://TEAM.example/ ')).toBe('https://team.example');
    expect(AppUrlSchema.parse('http://172.20.10.183:3003')).toBe('http://172.20.10.183:3003');
    expect(AppUrlSchema.parse('http://127.0.0.1:3003')).toBe('http://127.0.0.1:3003');
  });
  it.each([
    'http://public.example',
    'https://u:p@example.com',
    'https://example.com/path',
    'https://example.com?token=secret',
    'https://example.com/#fragment',
    'file:///app',
    'http://172.32.0.1',
    'http://169.254.169.254',
  ])('rejects an unsafe or ambiguous deployment URL: %s', (value) => {
    expect(AppUrlSchema.safeParse(value).success).toBe(false);
  });
  it('accepts only the versioned public allowlist and refuses secret keys', () => {
    expect(MobilePublicConfigSchema.safeParse(config).success).toBe(true);
    expect(
      MobilePublicConfigSchema.safeParse({ ...config, serviceRoleKey: 'secret' }).success,
    ).toBe(false);
    expect(
      MobilePublicConfigSchema.safeParse({
        ...config,
        supabaseAnonKey: 'sb_secret_do_not_publish_this',
      }).success,
    ).toBe(false);
    const jwt = (role: string) => `e30.${btoa(JSON.stringify({ role }))}.signature`;
    expect(
      MobilePublicConfigSchema.safeParse({ ...config, supabaseAnonKey: jwt('anon') }).success,
    ).toBe(true);
    expect(
      MobilePublicConfigSchema.safeParse({ ...config, supabaseAnonKey: jwt('service_role') })
        .success,
    ).toBe(false);
  });
  it('refuses HTTPS downgrades and an inaccessible localhost backend advertised to a phone', () => {
    expect(
      MobileConnectionSchema.safeParse({
        ...config,
        appUrl: 'https://team.example',
        supabaseUrl: 'http://192.168.1.2:54321',
      }).success,
    ).toBe(false);
    expect(
      MobileConnectionSchema.safeParse({
        ...config,
        appUrl: 'http://172.20.10.183:3003',
        supabaseUrl: 'http://127.0.0.1:54321',
      }).success,
    ).toBe(false);
    expect(
      MobileConnectionSchema.safeParse({
        ...config,
        appUrl: 'http://172.20.10.183:3003',
        supabaseUrl: 'http://172.20.10.183:54321',
      }).success,
    ).toBe(true);
  });
});
