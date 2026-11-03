# Hosted invitation delivery investigation — 2026-11-03

## Scope and evidence

BUG · MOD-WEB · FEAT-WEB-INVITES. User configured custom SMTP and reports that the intended Gmail recipient has not received the project invitation. Do not automatically resend or capture invitation tokens/passwords. Preserve existing local data and unrelated hosted settings.

- Project invitation exists and is pending, role Manager, expiry2026-11-10. Recipient details remain in ignored diagnostic artifacts rather than this handoff.
- Vercel request metadata shows the first POST /api/invitations at11:04:43 UTC returned502 (handler prepared the invite but Auth delivery failed). A later request at11:06:22 UTC returned200 (Auth API accepted the send request). Neither200 nor an Auth sent timestamp proves inbox delivery.
- Recipient Auth identity now exists, with invitation/confirmation sent timestamps and no email confirmation. This narrows the current investigation to the SMTP/provider delivery result and eventual recipient acceptance.
- Hosted custom SMTP is enabled: Brevo relay smtp-relay.brevo.com:587, sender administrator@snagflow.dev, display name Snagflow App. Secret SMTP settings were not printed or changed. The sender's verification/domain-authentication status and Brevo message events remain unobserved.
- User cannot receive mail at administrator@snagflow.dev. This does not itself prove an unverified sender (domain verification may be configured), but the Brevo sender/domain status needs checking. See [Brevo SMTP troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).
- Requested the latest recipient-filtered Brevo Transactional Log status/reason from the user. Brevo delivery logs are not connected here. No new email has been sent by this investigation.

## Confirmed redirect mismatch

Vercel APP_URL and NEXT_PUBLIC_APP_URL are https://snagflow.vercel.app. Supabase Site URL is https://snagflow-asche.vercel.app/ and its redirect allowlist includes only the alternate alias and preview patterns, not the actual invitation origin. This is a separate invitation-opening problem; it is not evidence of why Gmail has not received the message.

Prepared a local-only correction: set Site URL to https://snagflow.vercel.app; preserve existing aliases and append https://snagflow.vercel.app/invite/** and exact snagflow://auth/callback. A config diff shows exactly two declared updates (site URL and redirect list). SMTP settings are remote-only and must remain unchanged. Hosted approval was requested; no config push has occurred.

## Diagnostics and limits

- Read-only hosted SQL, Vercel request metadata, production origin inspection and Supabase config pull/diff used the existing authenticated CLIs. Config pull wrote only an ignored scratch directory; it did not overwrite repository supabase/config.toml.
- Temporary production dotenv containing credentials was removed immediately after inspecting allowlisted public origins/key presence. Other artifacts are ignored under .superpowers/apk. Do not commit SMTP credentials, Auth tokens or recipient email links.
- Vercel Hobby runtime logs do not retain the requested historical window. The request records remain sufficient to identify502 then200; the web route intentionally returns a generic delivery error and does not log SMTP credentials.
- No application code, permission rule, migration or database data was changed by the investigation. Sender verification, delivery/bounce status, actual inbox receipt and successful invitation acceptance remain pending.

## Confirmed provider cause and user decision

- User supplied Brevo's exact rejection: sender administrator@snagflow.dev is not valid; validate the sender or authenticate its domain. This confirms provider-side sender validation prevented delivery after Supabase accepted the invitation request. It is not an unconfirmed SMTP-password or recipient-inbox hypothesis.
- User explicitly chose “Leave settings unchanged” for the proposed redirect correction. Do not push the prepared config or modify Site URL/redirect allowlists. The mismatch remains documented as a separate potential invitation-opening limitation.
- Next: user selects an address whose verification mail they can receive, verifies it as a Brevo sender, or authenticates a domain they control. Then align Supabase SMTP's sender address with that verified identity. This sender is independent of the existing SnagFlow administrator login; do not rename that Auth account.
- No sender/config change or resend has been made. Sender choice/verification is pending. Do not assume the recipient address is authorized as a sending identity, and do not resend until the provider issue is resolved and the send is requested.

## User-reported delivery result

User changed to a personal sender email and reports that delivery now works, with the message arriving in spam. The earlier invalid-sender rejection is resolved according to this user observation. Inbox placement, domain authentication and completed invitation acceptance are not verified. No sender address was supplied to or changed by the agent. Redirect correction remains explicitly declined; preserve the existing URL settings.

## Recipient sent to sign-in instead of password setup

User reports opening the delivered invitation leads to sign-in. Read-only verification confirms Supabase still omits https://snagflow.vercel.app/invite/** from allowed redirects and Site URL remains the alternate alias. The app route explicitly permits anonymous /invite/* and renders InvitationForm with password setup; the root path requires a cookie session, so fallback to the site root loses the intended invitation flow. Recipient email is now confirmed, consistent with the clicked Auth link being consumed, while invitation acceptance is not yet verified.

Do not apply the previously declined broad redirect correction. The smallest proposed fix is to append only https://snagflow.vercel.app/invite/** to the existing allowlist, preserving Site URL, aliases, native callback and SMTP settings. Obtain explicit permission before applying. Afterward the administrator should use Retry send for the same pending invite and the recipient should open the newest message; the existing handler can issue recovery for a consumed Auth invitation. Do not resend or expose secret links automatically.

## Approved single-redirect correction applied

User replied “ok” to adding only https://snagflow.vercel.app/invite/**. This authorizes that one allowlist addition, not the earlier broader proposal. A fresh read captured four existing redirect entries. A minimal isolated config declared only auth.additional_redirect_urls; the pre-push diff showed exactly one declared update and preserved all four aliases. CLI config push applied it to mtpmqnczwdbglebrakhw.

Independent config diff/read-back confirms the declared redirect now matches, and all other observed remote settings are unchanged. Site URL, SMTP, signup settings and native callbacks were not modified. No database data, application code, Vercel deployment or email send was changed. Evidence is ignored in .superpowers/apk/redirect-only-{before,proposed,applied,after}.json.

Next recipient step: administrator uses Retry send on the same pending invitation, then recipient opens the newest email and completes full-name/password setup on Accept invitation. Earlier Auth links were consumed; do not reuse them. Actual completion and project membership remain unverified until observed.

## User-verified acceptance

User explicitly confirmed that the newest invitation allowed password setup and successful project joining after the single-redirect correction. This verifies the hosted invitation flow through recipient acceptance by user observation. Sender rejection is resolved; email was received in spam. Inbox placement/domain authentication, the full native hosted acceptance matrix and the separately pending signup configuration are not implied complete. No additional configuration change or email send was performed for this confirmation.
