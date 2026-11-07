# Commercial experience refinement — November 6

The visual direction stays established. Work is phased around correctness, feedback and dependable workflows.

## Baseline read-only audit

At the start of this pass, commercial workspaces contained 41 invoices: 39 saved, one ready for review and one pending. There were 206 active saved charge lines, no undated saved invoices, and four normalized-name groups bought across suppliers. Bean-sprout descriptions included “Bean Sprouts”, “Bean sprouts” and “Bean Sprout”. These are aggregate observations; no customer invoices were modified by this audit.

## Phase 1 — product identity and supplier options (implemented)

- Business Purchased products and Home product carousel group matching names across suppliers. Case/spacing and the specific bean-sprout spelling variants are normalized. Package, brand, preparation and other specifications in names remain meaningful; there is no fuzzy matching that guesses equivalence.
- Each group exposes its supplier/package options. Original labels, quantities, prices and invoice links remain available. Search by a supplier returns the complete matching group for comparison.
- Reorder timing and Smart Sift reviews remain scoped to the original supplier/description/unit key. Prices are not pooled across packs or suppliers. Existing recipe costing and saved supplier references retain their exact identities.
- Group pagination happens on the server, so a product does not split across pages. Saved products are labelled “Saved supplier options” for Business to distinguish them from the grouped Purchased view. Personal receipt identity rules are unchanged.

## Phase 2 — feedback after saving invoices (implemented)

- Total spending, invoice/supplier counts, averages, all-time total, supplier amounts and the existing spend cards animate from their previous value to the new value in about 800ms.
- Updates start from the current displayed value if another update arrives. Currency formatting and final cents are preserved; credits animate down accurately.
- Changing periods/workspaces settles directly into the new context. Refreshes retain prior values; first-load errors show unavailable states rather than invented zero spending. Reduce Motion skips counting, and screen readers receive the final value without intermediate live announcements. Leaving the app cancels the animation.

## Phase 3 — immediate UX gaps (implemented)

- Invoice-library and supplier-history failures previously cleared the list and resembled “no invoices”. They now preserve loaded data, explain the failure and offer retry.
- Dashboard failures expose a persistent refresh warning and retry, rather than relying only on a toast. Existing values are labelled as previously loaded data.
- Supplier detail can load its own metadata when opened directly, rather than depending on an already populated dashboard registry. Demo exploration remains local.
- Invoice libraries and supplier histories now page beyond the API's default single-response limit, with stable ordering and deduplication.
- Product pagination failures retain the already loaded products. Supplier/package labels make comparisons explicit, and the Home option chooser stays collapsed until requested.

## Phase 4 — confirmed matching (implemented)

Business users can now explicitly link differently named products after reviewing the match, see a team grouping history, and undo links in reverse order. Future same-name purchases follow the confirmed association. Original supplier/package pricing, invoice records, recipe references and Smart Sift evidence stay separate. Stale reviews and cross-workspace changes are rejected. See `CONFIRMED_PRODUCT_MATCHING.md`. Procurement comparisons, receiving/credit resolution, operational phone QA and paid-experience evaluation remain the next phases.


## Next phases — deliberate product decisions and deeper validation

1. **Procurement decisions:** preferred supplier per product, like-for-like normalized comparison coverage, actual fees/minimum orders, and clear provenance/freshness. No “cheapest supplier” claim without comparable packages and costs.
2. **Receiving workflow:** received quantity vs billed quantity, partial delivery/credit resolution, and a focused outstanding-issues list. Preserve financial evidence and reversible corrections.
3. **Operational reliability:** phone tests for interruption/offline retry, larger invoice sets, keyboard and VoiceOver, multiple collaborators and navigation; then accessibility and performance measurements on real devices. Browser fixtures and SQL tests do not establish physical-phone readiness.
4. **Paid experience:** evaluate whether each Smart Sift result creates an actionable decision, measure unlock comprehension and review completion, and verify entitlement/error recovery across Business plans.

5. **Matching suggestions:** propose possible equivalents with visible evidence for explicit review. Never apply uncertain matches automatically. Manual linking and Undo are already available in Phase 4.

No inventory quantity or order recommendation should be asserted from invoices alone. Future phases remain open; they are not represented as shipped features.

## Verification for phases 1–3

TypeScript, lint and 55 Node tests passed. Ten PostgreSQL assertions cover grouping, search, group-level pagination, tenant boundaries, unchanged invoices and isolated reorder evidence. Eight hosted checks with disposable Clerk identities confirm the deployed RPC behavior; all synthetic records and identities were cleaned up. The actual product components were inspected in a 375px browser fixture: one product expands into both supplier options and their distinct normalized prices. Browser background-state updates correctly settle on the final total; a physical-phone foreground animation/VoiceOver check remains part of the operational reliability phase.
