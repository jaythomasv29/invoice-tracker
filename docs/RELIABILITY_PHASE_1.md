# Reliability pass — November 7, 2026

Status: implemented locally; not released to the phone or submitted for App Review. Preserve the existing uncommitted Home, invoice-credit and listing work. App Store candidate 1.0.0 (9) predates this pass.

## First six audit findings

1. **Purchase confirmation:** confirmed StoreKit purchases enter a pending activation state while the backend catches up. Sync/reload errors no longer become a false purchase-failed message. Users can check again without purchasing again. Reopening the paywall reuses an existing matching Pro entitlement before opening another purchase sheet. An indeterminate SDK result directs users to check Apple or restore first.
2. **Interrupted/offline capture:** each batch is copied to app document storage before its manifest is committed. Drafts are isolated by authentication instance, user and workspace. Capture pages and upload draft IDs recover after relaunch; retries reuse the draft. Upload failures keep photos and show actionable copy. Retries are manual, not falsely promised as automatic. Missing pages stop recovery rather than silently uploading an incomplete document. Account deletion clears the owner's local captures.
3. **Paid scan cap:** the message explains the monthly reset at 00:00 UTC and offers access to saved history. Paid users are not asked to repurchase their current plan.
4. **Duplicate preflight and long scans:** the advisory fingerprint lookup can fail without failing extraction; final duplicate enforcement remains. The client allows 240 seconds and treats uncertain transport results as potentially still processing. The inbox polls and reconciles server status instead of prematurely declaring a running job failed.
5. **Sample tour:** UI edits stay local and service mutation boundaries reject sample record IDs before any database call. This includes invoice details, line edits/removal, deletion and credit actions.
6. **CSV:** credits remain numeric negative values, removed rows are excluded, dates use ISO format, unit prices retain four decimal places, and text formula injection protection remains. Invalid numeric values become empty cells rather than fabricated zeroes.

## Verification

- `npm run check`: type checking, lint and all 103 regression tests passed, including the final rerun after the existing-entitlement guard.
- `deno check supabase/functions/extract-invoice/index.ts`: passed.
- Tests include delayed activation and workspace changes, durable capture restart/recovery and copy failures, isolated drafts, CSV arithmetic/date/escaping, and actual service mutation calls proving sample data never reaches the database.
- The earlier simulator QA report was partial (empty Business Home), not a complete regression run.
- Fresh simulator build: `78768c28-3845-4f13-8466-849a55a11ba0` finished successfully and was installed only on Sift StoreKit QA (`6E936AE9-A11A-4C5E-B190-F92E06EF4A7C`, iOS 18.6). It snapshots the main changes before the final recovery-copy, existing-entitlement and temporary-file cleanup refinements. Do not treat it as a byte-for-byte verification of the final working tree.
- Native recovery check passed: imported `docs/fixtures/sift-test-invoice.jpg`, declined Smart Sift consent, verified “Upload 1 photo”, terminated the app, relaunched, reopened Scan and verified “Upload 1 photo” returned. No extraction was authorized or started. Existing saved review-account data remained visible. The fictional draft is intentionally retained in the isolated QA workspace.

## Release checks still required

- Extend the passing single-photo cold-restart check to multi-page capture, interrupted upload, workspace switching and uploading exactly once, using the final release binary.
- Complete real sandbox purchases for both plans and restore an active subscription. Simulator price loading, cancellation and empty restore passed previously; Apple sandbox authentication blocked successful transactions. Unit tests do not replace this check.
- Deploy and verify the changed extraction function before claiming the advisory duplicate fix is live.
- Build/release the final app code and test phone receipt; build 9 and the existing production release have not been updated by this pass.
- Review the separate credit-tracking migration and partial delivery-credit feature before rollout. The full received/short/substituted workflow, PDF/email import, pack-size alerts and weekly email remain a later phase.
