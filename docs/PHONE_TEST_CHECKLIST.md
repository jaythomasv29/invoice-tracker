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
