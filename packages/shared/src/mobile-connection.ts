import { z } from 'zod';

// Both supported app runtimes provide WHATWG URL. Keep this contract package's
// emitted declarations independent of DOM/Node ambient libraries.
type ParsedUrl = {
  username: string;
  password: string;
  search: string;
  hash: string;
  pathname: string;
  protocol: string;
  hostname: string;
  origin: string;
};
const RuntimeUrl = (globalThis as typeof globalThis & { URL: new (value: string) => ParsedUrl })
  .URL;

export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(host);
}
export function isPrivateDevelopmentHost(host: string): boolean {
  const octets = host.split('.').map(Number);
  if (isLoopbackHost(host)) return true;
  if (octets.length !== 4 || octets.some((v) => !Number.isInteger(v) || v < 0 || v > 255))
    return false;
  return (
    octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
  );
}
export const AppUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .transform((value, context) => {
    try {
      const url = new RuntimeUrl(value);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.pathname !== '/' && url.pathname !== '') ||
        (url.protocol !== 'https:' &&
          !(url.protocol === 'http:' && isPrivateDevelopmentHost(url.hostname)))
      )
        throw Error();
      return url.origin;
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Enter an HTTPS app address, or an HTTP private IP address for local testing. Use the address only, without a path, password or query.',
      });
      return z.NEVER;
    }
  });

/** Decode only the bounded ASCII JWT claims needed to reject privileged configuration keys. */
function legacyRole(key: string): unknown {
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0,
      value = 0,
      decoded = '';
    for (const char of parts[1]!.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, '')) {
      const digit = alphabet.indexOf(char);
      if (digit < 0) return null;
      value = (value << 6) | digit;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        decoded += String.fromCharCode((value >> bits) & 255);
      }
    }
    const claims: unknown = JSON.parse(decoded);
    return claims && typeof claims === 'object' && 'role' in claims ? claims.role : null;
  } catch {
    return null;
  }
}
export const PublicSupabaseKeySchema = z
  .string()
  .min(20)
  .max(8192)
  .refine(
    (key) => /^sb_publishable_[a-zA-Z0-9_-]+$/.test(key) || legacyRole(key) === 'anon',
    'Only a public publishable or anon key can be advertised.',
  );
export const MobilePublicConfigSchema = z
  .object({
    application: z.literal('SnagFlow'),
    version: z.literal(1),
    supabaseUrl: AppUrlSchema,
    supabaseAnonKey: PublicSupabaseKeySchema,
  })
  .strict();
export const MobileConnectionSchema = MobilePublicConfigSchema.extend({
  appUrl: AppUrlSchema,
}).superRefine((value, context) => {
  const app = new RuntimeUrl(value.appUrl),
    backend = new RuntimeUrl(value.supabaseUrl);
  if (app.protocol === 'https:' && backend.protocol !== 'https:')
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An HTTPS app must advertise an HTTPS backend.',
    });
  if (!isLoopbackHost(app.hostname) && isLoopbackHost(backend.hostname))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'This server advertises a localhost backend. Configure MOBILE_PUBLIC_SUPABASE_URL with the phone-reachable address.',
    });
});
export type MobileConnection = z.infer<typeof MobileConnectionSchema>;
