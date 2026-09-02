# Invariants

Intended security invariants for this MVP. Status is from code review plus the existing 14 tests (`forge test` 2026-09-02, remapped complete `forge-std` v1.16.2). Branch coverage of `BoundWallet.sol` is **50%** — several deny branches have no test (see `coverage.md`).

| ID | Invariant | Status |
| --- | --- | --- |
| I1 | Agent key ≠ owner key; agent cannot `registerPolicy` | Holds in code (`msg.sender != owner`). **Untested** deny branch. |
| I2 | Agent cannot `revokePolicy` | Holds in code (`msg.sender != policy.owner`). **Untested** deny branch. |
| I3 | `executeAction` requires EIP-712 signer == `policy.agent` | Holds. Test: `test_executeAction_revertsWrongAgent`. Domain: name/version/chainId/`address(this)`. |
| I4 | Inactive or missing policy cannot execute | Holds. Test: revoke then execute. Missing-policy branch **untested**. |
| I5 | Outside `[validAfter, validUntil]` cannot execute | Holds. Two tests (before / expired). Inclusive endpoints (`<` / `>`). |
| I6 | Nonce unique per `policyHash` | Holds. Replay test. Nonces are **not** global across policies. |
| I7 | Native `value` ≤ `maxValuePerTx` | Holds for the `value` field. Test: over max tx. |
| I8 | If `maxValuePerDay > 0`, native daily spend + `value` ≤ cap | Holds for `value`. Test: daily cap. `maxValuePerDay == 0` means **unlimited** native daily (documented). |
| I9 | `target` allowlisted and not blocked | Holds. Blocked checked first. Tests for both. |
| I10 | `action` string ∈ allowed set | Holds as **string match only**. Test: `"swap"` denied when only `"transfer"` allowed. |
| I11 | Inner call failure reverts whole tx (nonce/spend undone) | Holds by Solidity revert. **Untested** (`execution failed` branch uncovered). |
| I12 | Risk: `getLatestRiskScore(agentId) > minVerificationScore` ⇒ deny | Holds when oracle returns a high score. Test: score `MIN_SCORE+1`. Unset mapping ⇒ **0** ⇒ pass (fail-open). |
| I13 | Policy fields other than `isActive` are immutable | Holds (no setters). New policy = new hash / `policyCount++`. |
| I14 | CEI: nonce + daily spend written before `call` | Holds. Reentrancy cannot reuse same nonce; extra calls still need extra signatures. |
| I15 | Caps and allowlist constrain ERC-20 `to`/`amount` in `data` | **Does not hold.** Not an ERC-8196 `value`-in-wei guarantee. See OPEN H3/H4. |
| I16 | At most one active policy (UI “the bound”) | **Does not hold on-chain.** UI stores one hash. |
| I17 | Agent OS revoke stops `executeAction` | **Does not hold.** Unwired. |

## Default demo envelope (what the 3-minute path actually guarantees)

Policy defaults: action `transfer`, allowlist = recipient EOA only, 1 ETH/tx, 5 ETH/day, min score 20, mock score 5.

Then I7–I10 + EOA `data` no-op ⇒ agent can move **at most capped native ETH to that EOA**, not the 1000 MOCK, not arbitrary contracts.

That envelope is the one with runtime deny tests. Broader policies (token/router in allowlist) leave I15.
