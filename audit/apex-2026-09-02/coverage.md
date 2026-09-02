# Coverage

Honest, not CI-green theater. CI “14/14” was re-run locally on 2026-09-02 with Foundry 1.8.1 and complete `forge-std` v1.16.2 (local snapshot’s vendored std was incomplete; `origin/main` later switched CI to install v1.16.2 — **product Solidity/UI unchanged**).

## Overall (security surface)

**~55%** of the in-scope review surface has runtime or complete static coverage.

Weighting used:

| Slice | Weight | Covered | Notes |
| --- | --- | --- | --- |
| Native-ETH policy path (`executeAction` checks 1–8, 10–12 for EOA target) | 30% | ~85% | 14 tests; deny tests for cap, daily, allow, block, action, time, sig, nonce, risk, revoke |
| Register/revoke auth + failure branches | 10% | ~40% | Code read; **untested** not-owner / zero agent / bad window / policy not found / execution failed / bad `v` |
| Calldata / action binding / ERC-20 metering | 15% | ~30% | Happy-path ERC-20 **success** in tests; no deny-test that inner `to`/amount must be capped |
| Permission UI vs chain | 20% | ~50% | 100% of register/simulate/revoke TS read; **0%** browser e2e |
| Mocks as deployed | 5% | ~70% | Oracle 100% lines; ERC-20 transfer path hit; `mint`/`approve` unused in tests |
| Track A / Agent OS | 10% | ~15% | Docs only; no MCP |
| Entropy / 4337 / real 8126 | 10% | ~10% | Declared stub / OOS |

## Forge coverage (`BoundWallet.sol` only)

`forge coverage --ir-minimum` (via-IR project):

| Metric | BoundWallet.sol |
| --- | --- |
| Lines | **94.50%** (103/109) |
| Statements | **87.02%** (114/131) |
| Branches | **50.00%** (12/24) |
| Functions | **91.67%** (11/12) |

Uncovered lines: `receive()`; `success = true`; `sessionId = policyHash` assignment; assembly loads in `_recover`.

Untaken deny branches (line numbers in `src/BoundWallet.sol`): constructor zero oracle (61); register not owner / zero agent / bad window (85–87); policy not found (147); inner call failed (209); revoke not found / not owner / already inactive (219–221); sig length (316); `v` normalize / invalid `v` (325–326).

**Do not read 94% lines as “policy is proven.”** Branch coverage is half; the missing half is mostly **fail-closed auth and malformed-sig paths** that static review still checked.

## Tests vs real paths (the hunches)

| Path | In the 14 tests? | Review |
| --- | --- | --- |
| Native over cap / daily / expired / early / wrong agent / replay / high risk / bad action / not allowlisted / blocked / revoke | Yes | Strong |
| ERC-20 via `data` under ETH caps | Yes **as success** (25 MOCK, `value=0`) | Evidence for OPEN H4, not a deny |
| Token `transfer` to a **non-allowlisted** `to` | No | Static: not checked (H3/H4) |
| `approve` on allowlisted token | No | Static: allowed if token allowlisted |
| Second policy still active after UI “revoke” | No | Static: H14 |
| Agent `registerPolicy` / `revokePolicy` | No | Static kill H12 |
| UI preview vs submitted `data` | No e2e | Simulate always `data=0x` |
| Agent OS assign/revoke | No | Unwired |

## UI

Zero automated tests (`ui/package.json` has no `test` script). Coverage of UI security behavior is **code review only**.

## What this number is not

- Not “55% chance of a bug”
- Not an audit firm’s line-coverage gate
- Not a substitute for fuzz / invariant / mainnet fork (none exist; Anvil-only is appropriate)
