# Killed leads

False positives, spec-inherent behavior, documented stubs, or out of threat model. None of these are Confirmed High/Critical.

## H1 — Silent extra allowlist at register

`registerPolicy` in the UI sends `parseActionList(draft.allowedActions)` and `parseAddressList(draft.allowedContracts|blockedContracts)` after `getAddress`. Default `allowedContracts` is only `RECIPIENT_ADDRESS`. Token address is **not** auto-inserted. What is in the textareas is what is registered.

## H5 — Track A Agent OS vs on-chain policy

`agent-os/TRACK-A-MCP-HUB.md` states assign/revoke on binance.com is a **camera fallback**, not MCP, and live CEX is out of scope. There is no code path from Agent OS to `BoundWallet`. Binance revoke cannot stop `executeAction`. That is a documented split, not a hidden bypass. Do not report as a wallet High while Track A is unwired.

## H6 — `MockRiskOracle.setScore` has no access control

True. Anyone on Anvil can set any `agentId` score (bypass to 0 or DoS to 255). README + UI label it a mock ERC-8126 stand-in. Constructor oracle is immutable so production would swap the address. Kill as product High **for this repo’s stated environment**. Re-open if this mock is deployed as a real risk gate.

## H7 — Entropy commit–reveal missing

`entropyCommitment` is stored on the audit entry. README: commit–reveal stubbed; no `EntropyVerificationFailed`. Spec optional-ish for an hour-2 demo. Kill as High. Residual: ERC-8196 host-manipulation mitigation is absent.

## H8 — ERC-4337 / AA validation

No `IAccount`, no `validateUserOp`, no bundled UserOp. README lists ERC-4337 bundler as out of scope. “AA wallet” here means policy-bound `executeAction`, not 4337. No AA validation surface to exploit.

## H9 — Anyone can relay `executeAction`

Spec does not require `msg.sender == owner`. Signature binds the action. Agent with gas can self-submit. UI “owner relays” is not an invariant (A9).

## H10 — Replay

Nonce consumed per `policyHash` after success; failures revert consumption. Domain separator includes `chainId` and `verifyingContract`. `validUntil` in the struct is `policy.validUntil`. High-`s` ECDSA malleability does not double-spend a nonce. Kill.

## H11 — Reentrancy out of the inner `call`

Nonce and `spentOnDay` update before `target.call`. Reentering `executeAction` needs another valid unused nonce/signature. Audit-after-call can reorder entries under nested calls but does not print extra value without extra signed `value`. Kill as theft.

## H12 — Agent registers or revokes

`registerPolicy`: `msg.sender != owner`. `revokePolicy`: `msg.sender != policy.owner`. `policy.owner` is the registrar EOA. Agent cannot pass. **Deny branches are untested** (coverage.md) but the checks are unconditional. Kill as a bug; keep as a coverage gap.

## H13 — Unset risk score is 0 (pass)

`MockRiskOracle` mapping defaults to 0; `0 > threshold` is false for any `uint8` threshold. Spec rejects only when score **exceeds** `minVerificationScore`. Fail-open on “never verified” is mock-shaped. Kill as High for Anvil mock. Production ERC-8126 should fail closed on missing verification (assumption A2).

## H15 — No global pause

ERC-8196 revoke is per `policyHash`. Owner can revoke each policy or let them expire. Kill as a spec mismatch. Related UI issue remains OPEN as H14.

## H16 — Well-known keys in the frontend

Anvil account #0/#1 documented in README. Kill under A1.

## H17 — Vite `/rpc` proxy, `host: 0.0.0.0`, `allowedHosts: true`

A hosted preview can reach the operator’s Anvil. Keys are already public on Anvil. Kill as production High; demo-network exposure only.

## Other kills (short)

| Lead | Why killed |
| --- | --- |
| Signature length / `v` not 27/28 | `_recover` returns `address(0)`; agent cannot be 0. Untested branches, fail closed. |
| Empty `allowedActions` / empty allowlist | Chain allows register; execute cannot pass action/target checks. Fail closed. UI requires non-empty. |
| `maxValuePerTx == 0` | Only `value = 0` calls; still arbitrary `data` if a contract is allowlisted → folded into H3/H4, not a separate High. |
| No owner `withdraw` | Recovery = new policy with owner-controlled agent. Not theft. |
| Oracle not IERC-165 / wrong interface | `getLatestRiskScore` would revert; fail closed. |
| Policy hash collision | Hash includes `address(this)`, monotonic `id`, full params. |
| `executeAction` `success = true` dead store | Uncovered line; not economic. |
| Audit omits `data` | Forensics gap, not a transfer bypass. |
| `getPolicy` incomplete | Display/API; mappings are public. |
| EIP-1271 contract agents | Unsupported; fail closed (ecrecover). |
| Front-run signed action | Intended relay semantics. |
| `DELEGATION_TYPEHASH` unused | Spec extra; not a hole in execute. |
| Token `mint` public | Mock. Kill. |
