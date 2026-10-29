# Password recovery through Brevo Free

Keep Turso/Argon2id as the account authority and preserve the restored avatars/upload.

1. Test real database transactions for expiry, one-time use, concurrent consumption, session revocation and request limits.
2. Add a Drizzle migration for hashed reset tokens; reuse login_attempts for bounded request/delivery reservations.
3. Send transactional mail through Brevo's HTTP API with server-only credentials, a fixed HTTPS APP_URL and bounded timeouts. Never log tokens or expose account existence.
4. Add recovery/reset pages using existing auth styling; email links carry the secret in the fragment, not the query. Replace the unrelated Firebase reset callback.
5. Validate locally before staging/production. Configure the free provider only after the user supplies the sender address and completes required account/credential confirmations. Do not claim actual mail delivery until measured.

Pending sender: requested from user. No paid plan, new dependency or production write is authorized by this plan alone; use the user's existing production authorization with fresh backups for the migration.
