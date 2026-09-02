# DESK — Apex Sentinel standing output

**Bound Wallet** (Xira, ERC-8196 + permission UI, Binance Agent OS Track A camera fallback)  
**2026-09-02** · pack: `audit/apex-2026-09-02/`

## Scope

`READ_ONLY_PRODUCTION`. Live = **NO**. Owner product self-check. No mainnet, no user funds, no Track A submit, no broadcast exploit. In: `BoundWallet`, mocks as deployed, permission UI, 14 unit tests as evidence, Track A markdown. Out: real ERC-8126, ERC-4337 bundler, entropy reveal, live CEX/MCP.

## Environment

- Repo: `Kohap/bound-wallet` (review on product sources equivalent to `main` wallet/UI; later `main` commits only fix `forge-std` CI)
- Chain: Anvil 31337 only (not run as a long-lived node for this review)
- Tooling: Foundry 1.8.1, `forge test` **14 passed / 0 failed** with complete `forge-std` v1.16.2 remapping
- Method: architecture → asset flows → trust boundaries → invariants → hypotheses; kill false positives; no fund-moving PoCs

## Coverage %

**~55%** of the in-scope security surface (honest).  
`BoundWallet.sol` lines **94.5%**, branches **50%**. Native-ETH deny paths are well tested; register/revoke auth branches, calldata semantics, UI e2e, and Agent OS are not. Green CI is not absence of bugs. Detail: `coverage.md`.

## Confirmed findings (High/Critical only)

**None.**

No finding met **runtime + quantified economic** proof as a policy bypass on the **default demo envelope** (EOA recipient allowlist, native `value` caps, agent signature). Existing tests **confirm** over-cap / daily / time / nonce / wrong agent / risk / revoke **deny** for native ETH.

## Potential findings

Not confirmed High/Critical. Do not treat as a bug bounty table.

1. **H3/H4 — Action string + native `value` do not constrain ERC-20 `data`.** If a token/router is allowlisted, inner `to`/`amount` are unmetered. In-repo runtime: `test_executeAction_transferWithinCap` moves **25 MOCK** at `value = 0` under a **1 ETH** tx cap. Deploy seeds **1000 MOCK**. Default UI does **not** allowlist the token. Spec `maxValue*` is wei on `value`. Product call needed before this is High.
2. **H2 — Permission UI oversimplifies the grant.** Seal always “Native ETH”; `transfer` rendered as “Transfer native ETH”; allowlist omitted from the seal; simulate `data` always `0x`. Register itself is 1:1 with the form (H1 killed).
3. **H14 — N active policies, one UI hash.** Re-register does not revoke the previous policy. One revoke warning says the agent “cannot move funds.” Bound = sum of remaining active caps (or unbounded if any daily cap is 0).
4. **Track A (killed as High, still a trust note):** Agent OS assign/revoke does not bind or unbind `BoundWallet`. Documented camera fallback.

## Killed leads

Silent extra allowlist (H1); Agent OS as a chain kill switch (H5); mock oracle AC as production High (H6); entropy stub (H7); 4337 validation (H8); relay-must-be-owner (H9); replay/domain (H10); reentrancy drain (H11); agent register/revoke (H12, untested but checked); risk fail-open as mock High (H13); missing global pause vs spec (H15); Anvil keys (H16); `/rpc` demo proxy (H17). Reasons: `killed.md`.

## Next step

1. Relay this DESK to Xira: **not reportable as High/Critical** on the Anvil demo envelope.
2. If they want ERC-20 to be a real bounded action: decode `transfer`, allowlist inner `to`, meter `amount` (or drop token from allowlist / do not mint 1000 MOCK into the vault).
3. UI: disable or warn on a second `registerPolicy` without revoke; show allowlist + “N active policies” from logs; fix the global “cannot move funds” copy.
4. Add **deny-only** tests for H12 branches and inner-call failure (no attacker recipes).
5. Do not wire live Agent OS until revoke is the same object on both planes.
6. Do not deploy this mock oracle or well-known keys off Anvil.

## Reportable or not

**Not reportable** as Confirmed High/Critical.

OPEN items are hardening / spec-intent questions for any future non-Anvil build, not a live incident.
