# Sift standalone iPhone beta checklist

Install the newest Sift build from TestFlight using the invited Apple account. This beta uses live authentication; earlier development accounts/data are separate. Internet is required. No computer, local server or Expo Go is required.

1. Quit Expo/Metro and turn the computer off. Open Sift from the phone home screen.
2. Create/sign into an account using the emailed code; create the restaurant when prompted. Report any missing email, loop or blank screen.
3. Open Privacy, Terms and Support. Confirm links load on the phone.

Optional safe fixture: save [the fictional test invoice](fixtures/sift-test-invoice.jpg) into Photos before turning the computer off. It contains Roma Tomatoes (2 × $24 = $48) and Whole Milk (3 × $4 = $12), total $60. It contains no real transaction.

4. Scan a fictional or approved invoice. Decline the AI permission once and confirm scanning stops. Retry and accept; check the vendor, date, quantities, prices and total against the original.
5. Review and save. Force-quit Sift, reopen and confirm the saved invoice and photo load. Confirm the scan allowance updates.
6. Test photo-library import and a multi-page invoice. Cancel a scan and retry after a network interruption; check for duplicates.
7. Open Pro. Confirm Apple supplies the localized price and monthly billing terms. Purchase through the TestFlight sandbox, then confirm Pro features unlock. Restore purchases after signing out/in. TestFlight uses sandbox purchases; review Apple's purchase sheet before confirming.
8. Create and review a recipe cost, including manual corrections and AI permission withdrawal in Settings.
9. Sign out; confirm restaurant data disappears. Sign back in and confirm the correct restaurant data returns.
10. Use a disposable account to test Delete account. Confirm the warning, deletion result, sign-out and inability to reopen deleted restaurant data. Deleting an account does not cancel an Apple subscription; manage it in iPhone Settings.

Use chimpchamp92@gmail.com for this beta. After creating the production restaurant, tell the launch operator you have signed in so that specific restaurant can be allowed for sandbox entitlements before the purchase test. Do not send passwords, email codes or keys.

Report the build number, iOS version, step, expected result and actual result. A screenshot or recording helps for visual failures. Public release requires extraction/review accuracy, purchase/restore, deletion and these phone checks to pass.

## Build 5 regression checks

- While processing, try Close, swiping back, camera/import/flash controls and page removal. The processing modal should prevent those actions until the request finishes or fails. OS app switching/force-quit remains possible.
- Verify actual stage titles (prepare/upload/check/read/review), elapsed time and the longer-running hint. No exact ETA or artificial completion percentage is promised.
- Check Home's Daily/Weekly/Monthly totals, invoice/vendor counts and vendor amounts. Use the arrows to view an old invoice's period. Spending uses invoice date; upload activity and the current month's scan allowance use upload/processing timing independently.
- If a completed scan was interrupted before review, reopen it from Needs review and save it. Unsaved scans do not enter spending totals.
- Reimport the same invoice. Exact/strong duplicates should offer the existing invoice and no override; uncertain header matches can be explicitly added as a different invoice. Confirm duplicate attempts don't inflate successful scan usage or spending.
- Pro price issue remains open. After installing the update, try Pro and report the exact error text/support reference if no price loads. Do not mark purchase/restore passed until both complete on the phone.

## Beta over-the-air updates

- Install TestFlight version 1.0.0 (6), the OTA-enabled build (build 5 and older cannot receive updates).
- With the computer off, open Sift with internet, allow the background download, then force-quit and reopen it to apply a compatible beta update. TestFlight's build number stays unchanged.
- Confirm sign-in, restaurant, saved invoices, scanner and Pro behavior still work after the update; no account reset or reinstallation should be necessary.
- A successful publish/runtime match is infrastructure verification only. Actual phone receipt and behavior must be confirmed separately.


## Build 7 modern interface and icon

- Install 1.0.0 (7) from TestFlight and check the new green receipt-S icon.
- Open with internet, allow the beta interface update to download, then force-quit/reopen. Check Home says Kitchen overview and shows the dark-green Total spending card.
- With the computer off, verify sign-in, restaurant and saved invoices persist. Check day/week/month arrows, old invoice periods, top suppliers and invoice search.
- Verify recipe averages exclude missing menu prices and retain meaningful cost shares over 100%. Ingredient margin is an estimate, not total restaurant profit.
- Test invoice review with optional notes, scanner processing controls, duplicate protection and Pro price/purchase/restore. Report the exact visible error if Pro is unavailable; those checks are still open.


## November 3 supplier spending and motion update

- Keep existing real invoices. Do not delete, reset or re-import them to test this UI update.
- In Home's Total spending card, check the selected period includes your invoice dates. Each supplier should have a distinct segment and matching name/amount; totals must match the saved invoices.
- Switch Day/Week/Month and past periods. Colors should remain consistent for existing suppliers. Credits remain in net totals; negative supplier balances are listed but do not become misleading positive segments.
- Check press feedback on Home, invoice/library and recipe controls; check insights reveal, tab fades and detail navigation. Enable iOS Reduce Motion, reopen Sift, and verify these new transitions become immediate or reduced.
- Test on the physical phone before calling animation quality/device behavior verified. The update uses existing native dependencies and requires no invoice-data migration.


## Cancellation/end-date and reviewer access update

- Owner confirmed build 7 price loading, purchase, cancellation and resubscription. Restore purchases still needs an explicit successful result.
- Download the latest beta OTA, cold-launch again, and open Profile > Apple subscription. With renewal on, it should say Renews with Apple's date/time. After canceling auto-renewal, it should say Auto-renewal off and show Pro access until the paid-through date. Pro remains active until expiry; returning from Apple settings refreshes the status.
- TestFlight sandbox billing is accelerated; its renewal/expiry dates are not a real month of paid service. The status labels identify sandbox subscriptions.
- No owner data reset or account deletion is needed. Check all existing invoices and their source photos remain.
- A catch-weight item should show its billed pounds separately from the shipped case quantity. Opening Edit and changing only its description must preserve its printed extended total. Test actual edits only on a disposable/sample invoice.
- Capture the real paywall with price and monthly subscription terms visible for the subscription review screenshot. The existing Apple product review image is blank.
- Final public submission needs a fresh production-profile binary embedding the approved fixes and reviewer sign-in; no new native build is needed for these beta UI tests.
