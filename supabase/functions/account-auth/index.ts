// account-auth — pre-login account actions that need to resolve a USERNAME to an account
// without ever revealing the email behind it to the client.
//
// POST { action, ... } with the publishable key (no user session needed):
//   lookup         { identifier }            → { exists, hasProfile, maskedEmail }
//   login          { identifier, password }  → { session } | 404 user_not_found | 401 invalid_password
//   recover-start  { identifier }            → { maskedEmail } (emails a 6-digit code)
//   recover-verify { identifier, code }      → { session } (then the app sets a new password)
//
// Instagram tells you when an account doesn't exist ("Can't find account" / "We couldn't find
// your account"); the user chose to keep that behavior (DECISIONS.md, page 012).
import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type Account = { user_id: string; email: string; username: string | null; has_profile: boolean };

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function fail(status: number, error: string, message: string) {
  return json({ error, message }, status);
}

/** a•••@g•••.com */
function maskEmail(email: string): string {
  const [local, domain = ''] = email.split('@');
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local.slice(0, 1)}•••@${host.slice(0, 1)}•••${tld}`;
}

function authErrorResponse(error: { status?: number; code?: string; message: string }) {
  if (error.status === 429 || error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') {
    return fail(429, 'rate_limited', 'Please wait a few minutes before you try again.');
  }
  return fail(400, error.code ?? 'auth_error', error.message);
}

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'bad_request', 'Invalid JSON body');
    }

    const action = String(body.action ?? '');
    const identifier = String(body.identifier ?? '').trim();
    if (!identifier) return fail(400, 'bad_request', 'identifier is required');

    const { data, error } = await ctx.supabaseAdmin.rpc('auth_lookup', { identifier });
    if (error) return fail(500, 'lookup_failed', error.message);
    const account = (data as Account[] | null)?.[0] ?? null;

    if (action === 'lookup') {
      return json({
        exists: !!account,
        hasProfile: account?.has_profile ?? false,
        maskedEmail: account ? maskEmail(account.email) : null,
      });
    }

    if (!account) {
      return fail(404, 'user_not_found', "We couldn't find your account.");
    }

    switch (action) {
      case 'login': {
        const password = String(body.password ?? '');
        if (!password) return fail(400, 'bad_request', 'password is required');
        const { data: auth, error: authError } = await ctx.supabase.auth.signInWithPassword({
          email: account.email,
          password,
        });
        if (authError) {
          if (authError.code === 'invalid_credentials') {
            return fail(401, 'invalid_password', 'The password you entered is incorrect. Please try again.');
          }
          return authErrorResponse(authError);
        }
        return json({ session: auth.session });
      }

      case 'recover-start': {
        const { error: otpError } = await ctx.supabase.auth.signInWithOtp({
          email: account.email,
          options: { shouldCreateUser: false },
        });
        if (otpError) return authErrorResponse(otpError);
        return json({ maskedEmail: maskEmail(account.email) });
      }

      case 'recover-verify': {
        const code = String(body.code ?? '').trim();
        if (!/^\d{6}$/.test(code)) return fail(400, 'invalid_code', "This code isn't valid.");
        const { data: auth, error: verifyError } = await ctx.supabase.auth.verifyOtp({
          email: account.email,
          token: code,
          type: 'email',
        });
        if (verifyError) {
          if (verifyError.status === 429) return authErrorResponse(verifyError);
          // GoTrue reports wrong and expired codes alike (otp_expired).
          return fail(400, 'invalid_code', "This code isn't valid or has expired. You can request a new one.");
        }
        return json({ session: auth.session });
      }

      default:
        return fail(400, 'bad_request', `Unknown action "${action}"`);
    }
  }),
};
