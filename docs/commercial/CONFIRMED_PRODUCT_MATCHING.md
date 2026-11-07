# Confirmed product matching

Business Products → Purchased → expand a product → **Link with another product name**.

Choose a target product, review both sets of names and supplier/package options, then explicitly confirm that the names refer to the same product. The combined group uses the target's display name. All original supplier keys, prices, packages, invoices, recipe references and Smart Sift reorder evidence remain unchanged. Future purchases with a confirmed normalized name join that display group automatically.

**Grouping history & Undo** shows the team's recent decisions and places the latest active link first. Undo restores the exact previous alias assignments, including an earlier manual group. Workspaces serialize grouping mutations and undo them in reverse order so older decisions cannot overwrite newer edits. Stale source/target snapshots are rejected with a refresh action. There is no automatic fuzzy matching or model call.

Mapping and audit tables are workspace-scoped and read-only to ordinary clients. Changes go through scoped transactional RPCs; aliases cannot reference another workspace's group. The audit records the verified actor and keeps undone decisions. Account deletion removes grouping rows for deleted workspaces and clears author IDs in surviving workspaces. Demo mode and Personal UI do not offer these mutations; RPCs require a Business workspace.

The catalog RPC keeps its existing return shape for earlier beta clients. Added name-key and alias metadata live inside supplier-option JSON. Name grouping is a display association, and does not assert that different packages, varieties or preparation methods are interchangeable.

Validation: 57 Node tests, clean typecheck/lint, 25 SQL assertions for confirmed grouping plus prior catalog/invoice regression SQL; 17 hosted checks using disposable Clerk identities with complete cleanup; Deno checks for account-deletion functions. Browser QA with actual components and fictional records verified target selection, a disabled Confirm before acknowledgement, a successful link reducing two cards to one, history marking the change as Undone, and success feedback. Physical-phone keyboard, sheet navigation and VoiceOver remain operational QA items.
