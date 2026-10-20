/**
 * Fixed session cookie name.
 *
 * @supabase/ssr derives the cookie name from the URL host (`sb-<host>-auth-token`).
 * The browser reaches the local Supabase stack on 127.0.0.1 while the server
 * reaches it on host.docker.internal when the app runs in a container, so the
 * derived names would differ and the session would be split in two. A fixed
 * name keeps both sides on the same cookie.
 */
export const AUTH_COOKIE_NAME = "sb-snagflow-auth-token";
