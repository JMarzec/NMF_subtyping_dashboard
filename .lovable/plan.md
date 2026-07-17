
## Goal

Expose this dashboard as an OAuth-protected MCP server so AI clients (Claude, ChatGPT, Cursor…) can act as the signed-in user and read their saved NMF analyses.

## 1. Authentication

- Enable Email/Password + Google sign-in (Lovable Cloud defaults).
- Add `/auth` page (sign in, sign up, Google button) and a lightweight header sign-in state (avatar/email + sign out).
- Preserve `?next=` through email/password sign-in, signup `emailRedirectTo`, and Google `redirect_uri` — required so the OAuth consent route works.

## 2. Per-user data model

New tables in `public`, all RLS-scoped to `auth.uid()`:

- `profiles` — id → auth.users, email, display_name (auto-created via trigger)
- `analyses` — id, user_id, name, summary jsonb, survival_pvalue, cox_ph jsonb, created_at
- `analysis_samples` — analysis_id, sample_id, subtype, umap/pca coords, plus columns for survival
- `analysis_marker_genes` — analysis_id, gene, subtype, log_fold_change, p_value, rank
- `analysis_survival_curves` — analysis_id, subtype, time, survival, at_risk, censored

## 3. Dashboard integration (frontend only)

- After a JSON is uploaded (existing `JsonUploader`), if signed in, offer "Save analysis" → writes to the tables above.
- Add "My analyses" dropdown in the header to load a saved analysis back into current state (uses existing setters — no viz code changes).
- Guests keep the current upload-only flow; no forced login.

## 4. MCP server (OAuth-protected)

Uses `@lovable.dev/mcp-js` with Supabase edge function output.

- `src/lib/mcp/index.ts` — `defineMcp` with `auth.oauth.issuer({ issuer: https://<ref>.supabase.co/auth/v1, acceptedAudiences: "authenticated" })`.
- Tools (all scoped to the signed-in user via `ctx.getToken()` forwarded to Supabase, RLS runs as that user):
  - `list_analyses` — list the user's saved analyses (id, name, date, n_subtypes, n_samples)
  - `get_analysis_summary` — summary + subtype counts + optimal rank for one analysis
  - `get_marker_genes` — top N marker genes per subtype for an analysis
  - `get_survival_stats` — log-rank p-value, Cox PH hazard ratios/CIs for an analysis
  - `whoami` — signed-in user's email/id (sanity tool)
- `vite.config.ts` adds `mcpPlugin()` which emits `supabase/functions/mcp/index.ts` at build time.

## 5. Managed OAuth server + consent route

- Run `supabase--configure_oauth_server` to activate Supabase as the OAuth 2.1 authorization server with dynamic client registration.
- Add `/.lovable/oauth/consent` React route: reads `authorization_id`, requires session (redirect to `/auth?next=…` if not), shows client name + Approve/Deny using `supabase.auth.oauth.{getAuthorizationDetails,approveAuthorization,denyAuthorization}`.
- Ensure `/auth` consumes `next` on all three sign-in methods (password, signup email confirm, Google).

## 6. Deploy + register manifest

- Deploy the `mcp` edge function.
- Extract the MCP manifest so Lovable's Agent integrations panel lists the tools.
- Add a small "Connect to AI clients" section in the app pointing to the MCP endpoint URL.

## Technical notes

- Issuer built from `import.meta.env.VITE_SUPABASE_PROJECT_ID` (not `SUPABASE_URL`) — mcp-js rejects `.lovable.cloud` proxy hosts.
- Tool handlers create a per-request Supabase client with `Authorization: Bearer <ctx.getToken()>` so RLS applies. No service-role key anywhere.
- `src/lib/mcp/index.ts` and its tool files are import-safe: no env reads or throws at module top level.
- Existing dashboard code, visualizations, and the mock/default flow are untouched.

## Out of scope for this pass

- Migrating existing R-script CLI output into the new tables (users still upload JSON; save button is opt-in).
- Multivariate Cox / stratified results exposure over MCP (can add later once the base flow works).
