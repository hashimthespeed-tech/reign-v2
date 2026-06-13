# Phase 14 — Settings Page — Design

**Date:** 2026-06-13
**Status:** Approved (design); pending implementation plan.
**Phase:** 14 of the REIGN v2 build (`PHASES.md`).

The student-facing Settings page: profile editing, display preferences, the
real-money transition, and account management. Student-only — the `/settings`
route is already `StudentRoute`-guarded and the spec is student-framed. Teacher
settings are out of scope for this phase.

---

## Decisions locked in brainstorming

1. **Dark-mode toggle: dropped.** Reign's identity is the premium dark
   "sovereign" look; the whole app uses hardcoded dark tokens (`theme.js`) via
   inline styles. No toggle is built and it is not mentioned in the UI. (Diverges
   intentionally from the written spec's Display bullet.)
2. **Timezone: display-only, localStorage.** Student picks a timezone that only
   affects how dates/times render in the UI. No schema change; all market/report
   timing stays US Eastern server-side.
3. **Delete account: real service_role Netlify function.** Hard delete of the
   auth user; ON DELETE CASCADE FKs remove all dependent rows. Typed-confirmation
   modal.
4. **Affiliate links: env vars with graceful fallback.** Read from
   `VITE_AFFILIATE_ROBINHOOD|VANGUARD|FIDELITY`; missing var → disabled
   "link coming soon" button. Real links can be dropped into `.env` with no code
   change.
5. **Avatars: generated geometric/monogram presets.** Curated CSS/SVG avatars
   (gold-on-dark monograms / geometric crests). No external assets or network
   calls. `avatar_url` stores a preset id (e.g. `crest-3`).

## No manual SQL this phase

Every column needed already exists:
- `profiles`: `username`, `investor_type`, `avatar_url`, `class_id`, `full_name`,
  `school_name`.
- `classes`: `class_code`, `show_real_money`, `semester_end_date`.

Timezone lives in localStorage. Avatars store a preset id in the existing
`avatar_url`. Account deletion uses the service_role admin API, which already has
table grants from `05_service_role_grants.sql`.

---

## Architecture

| Unit | Purpose | Depends on |
|---|---|---|
| `src/pages/Settings.jsx` | The page, in `StudentLayout`. Replaces the `ComingSoon` stub at `/settings`. | `settings.js`, `Avatar.jsx`, `ui.jsx`, `AuthContext`, `supabase` |
| `src/lib/settings.js` | Pure, testable helpers (see below). No React, no I/O. | `constants.js` (investor types) |
| `src/components/Avatar.jsx` | Renders a gold-on-dark monogram/crest from a preset id + username initial. Reusable. | `theme.js` |
| `netlify/functions/delete-account.js` | service_role: verify caller JWT → `auth.admin.deleteUser(uid)`. | `_supabase.js`, `_util.js` |
| `scripts/verify-phase14.mjs` | Integration + pure-logic verification. | dev server / service_role |

### `src/lib/settings.js` — pure helpers
- `AVATAR_PRESETS` — array of `{ id, kind, palette }` describing each generated
  avatar. The visual is derived deterministically; no image files.
- `isRealMoneyUnlocked(klass, now = new Date())` — `true` iff
  `klass.show_real_money === true` AND `klass.semester_end_date` is a valid date
  that is strictly before `now`. Null/missing date → `false`.
- `TIMEZONES` — curated list `{ value (IANA), label }` (e.g. ET/CT/MT/PT/UTC/London).
- `formatInTimezone(date, tz)` — formats a timestamp for display in the chosen
  timezone (via `Intl.DateTimeFormat`). Display-only.
- `affiliateConfig(env = import.meta.env)` — returns the three broker cards:
  `{ key, name, bonus, url|null }`, reading
  `VITE_AFFILIATE_<BROKER>`; `url` is `null` when the env var is absent/blank.

## The four sections

### 1. Profile
- **Avatar picker** — grid of `AVATAR_PRESETS`; selecting one writes the preset id
  to `profiles.avatar_url`. Current selection highlighted.
- **Username** — editable text input; live availability check via the
  `check_username` RPC (debounced); blocks save on taken/invalid.
- **Investor type** — editable, choices from `INVESTOR_TYPES` (excludes
  `teacher`).
- **Class code** — read-only, from the fetched class row.
- Saves via `supabase.from('profiles').update({...}).eq('id', uid)` then
  `refreshProfile()`. Each field gives inline success/error feedback.

### 2. Display
- **Timezone** — `<select>` over `TIMEZONES`; persisted at localStorage key
  `reign_tz` (default ET). Live preview line: a sample report timestamp rendered
  via `formatInTimezone`. No effect on market/ET logic.

### 3. Real-Money Transition (conditional)
- Rendered **only if** `isRealMoneyUnlocked(klass)`.
- Gold-bordered card (`shadow.glow`) with three broker cards
  (Robinhood / Vanguard / Fidelity) from `affiliateConfig()`: name, signup-bonus
  copy, and a CTA button. Missing affiliate URL → disabled
  "Link coming soon" button.

### 4. Account
- **Change password** — `supabase.auth.updateUser({ password })` with a confirm
  field and validation.
- **Change email** — `supabase.auth.updateUser({ email })`. Email confirmation is
  OFF (per decision log), so the change applies immediately; surface the result.
- **Delete account** — destructive card; opens a modal requiring the user to type
  `DELETE`. On confirm, POST to `/.netlify/functions/delete-account` with the
  access token in the `Authorization` header → on success `signOut()` +
  `navigate('/')`.

### `netlify/functions/delete-account.js`
- POST only. Reads the bearer token, validates it with the service_role client
  (`auth.getUser(token)`) to resolve the caller's uid — never trusts a uid from
  the request body.
- `auth.admin.deleteUser(uid)`. Dependent rows (portfolios, holdings, trades,
  predictions, reports, etc.) are removed by existing ON DELETE CASCADE FKs.
- Returns `{ ok: true }` / appropriate error codes. Follows the existing
  `_util.js` response/CORS helpers and `_supabase.js` service_role client.

## Data flow
On load: `useAuth().profile` + a single fetch of the class row
(`class_code, show_real_money, semester_end_date`) by `profile.class_id`. All
mutations are the student writing only their own data (RLS-safe), except deletion
which is server-side via service_role.

## Error handling
- Username taken/invalid → inline error, save blocked.
- Profile/auth update failures → inline error message per field; no silent
  failures.
- Delete: any non-2xx from the function keeps the user signed in and shows the
  error; only a confirmed success signs out.
- Missing affiliate env vars are an expected state (disabled button), not an
  error.

## Verification — `scripts/verify-phase14.mjs`
Following the prior-phase pattern:
1. **Pure-logic** — `isRealMoneyUnlocked` across the
   `show_real_money` × `semester_end_date` (past/future/null) matrix; avatar
   preset integrity (unique ids, every preset renderable); `affiliateConfig`
   env-vs-fallback; `formatInTimezone` produces distinct output across zones.
2. **`delete-account` round-trip** — create a throwaway auth user via
   service_role, seed one dependent row, call the function, assert the user and
   the dependent row are gone; assert the function rejects a missing/invalid
   token.
3. Auth UI flows (password/email change) are smoke-checked manually in-browser,
   as in earlier phases.
Use `process.exitCode` (not `process.exit`) to avoid the Windows
`UV_HANDLE_CLOSING` race seen in Phase 11.

## Out of scope (this phase)
- Teacher settings.
- A real light theme (dark-mode toggle dropped).
- Persisting timezone to the DB.
- Profile picture uploads (presets only).
