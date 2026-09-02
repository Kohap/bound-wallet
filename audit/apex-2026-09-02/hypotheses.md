# Hypotheses

Statuses are **OPEN** or (moved to `killed.md`) **KILLED**. Nothing here is **CONFIRMED** High/Critical.

## OPEN

### H2 — UI seal / preview narrower than on-chain grant

**Hunch:** After register, the seal always says “Asset: Native ETH”, does not list allow/block addresses, and `actionInEnglish("transfer")` = “Transfer native ETH”. Preview warnings omit target allowlist, action allowlist, and nonce. Advanced raw view still omits `data`.

**Why open:** Static UI vs `executeAction(target, value, data, action)` is a real display gap. Default draft does not silently add extra addresses (that part killed as H1). Residual: user who **pastes a contract** into “Allowed contracts / recipients” still sees an ETH-only seal.

**Not confirmed High:** No extra addresses are added without user input; chain still enforces whatever was registered. Needs product intent + a non-default allowlist to become economic.

### H3 — `allowedActions` is self-attested; `data` is not bound to the label

**Hunch:** Agent signs `action = "transfer"` with arbitrary `data` (e.g. `approve`, `transfer` to a different `to`). Chain only checks the string set.

**Why open:** Matches ERC-8196’s underspecified `action`/`data` pair and Bound Wallet’s documented spec gap. Dangerous only if `allowedContracts` contains a contract with multiple behaviors.

**Not confirmed High:** Default demo allowlist is an EOA (`data` is a no-op). Binding action→selector is not in the published execute spec. Existing tests treat ERC-20 `transfer` in `data` as **success**, i.e. author intent.

### H4 — Native caps do not meter ERC-20 amounts (or inner `to`)

**Hunch:** If the token is allowlisted, `value = 0` + `data = transfer(to, amount)` ignores `maxValuePerTx` / `maxValuePerDay` and does not check `to` against `isAllowedContract`.

**Runtime already in-repo (not an exploit recipe):** `test_executeAction_transferWithinCap` sends **25 MOCK** with `value = 0` while `maxValuePerTx = 1 ether` and `maxValuePerDay = 5 ether`. Token **and** recipient are both allowlisted in that test; `to` is not what the mapping checks (the mapping checks `target` = token).

**Impact bound if token allowlisted:** up to `token.balanceOf(wallet)` per successful call (deploy seeds **1000 MOCK**), plus `approve` to any spender. Native ETH still capped.

**Not confirmed High:** See A7/A8. README and the passing test present this as the ERC-20 path. Default UI does not allowlist the token. Elevating requires a product ruling that token amounts must be capped.

### H14 — Multiple live policies; UI keeps one hash

**Hunch:** `registerPolicy` always increments `policyCount`. The Register button stays enabled after a bind. `setBound` replaces localStorage. Revoke hits only `bound.policyHash`. Warning: “The agent cannot move funds.”

**Why open:** Two clicks ⇒ two active policies ⇒ up to **sum of caps** still spendable after “revoke” of the displayed hash. Spec allows multiple policies; the contract is consistent. This is a UI/control-plane gap, not a signature bypass.

**Not confirmed High:** Requires owner to register more than once. No browser e2e in this review. Economic bound is owner-chosen (N × per-policy caps, or unbounded if any policy has `maxValuePerDay = 0`).

## Tracked hunches (disposition)

| ID | Hunch | Disposition |
| --- | --- | --- |
| H1 | UI silently allowlists more than the form shows | **KILLED** |
| H2 | Seal/preview narrower than grant | **OPEN** |
| H3 | Action label vs calldata | **OPEN** |
| H4 | ERC-20 amount / inner `to` uncapped | **OPEN** |
| H5 | Track A Agent OS trust | **KILLED** as High |
| H6 | Mock oracle world-writable | **KILLED** as High |
| H7 | Entropy stub | **KILLED** as High |
| H8 | ERC-4337 / AA validation edges | **KILLED** |
| H9 | Agent self-relay | **KILLED** |
| H10 | Signature replay / domain | **KILLED** |
| H11 | Reentrancy drain | **KILLED** |
| H12 | Agent register/revoke | **KILLED** |
| H13 | Risk fail-open on score 0 | **KILLED** as High (mock) |
| H14 | Multi-policy vs one UI bound | **OPEN** |
| H15 | No global pause | **KILLED** |
| H16 | Anvil keys in the bundle | **KILLED** |
| H17 | `/rpc` proxy + `allowedHosts: true` | **KILLED** as production High |
