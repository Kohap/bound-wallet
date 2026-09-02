# Architecture

Bound Wallet is a **dedicated ERC-8196 policy module**, not an ERC-4337 account. There is no `validateUserOp`, no session-key contract, and no upgrade proxy. One immutable `owner` is set in the constructor. An AI **agent** never becomes `owner`.

```
┌─────────────────────────────────────────────────────────────────┐
│ Permission UI (Vite/React/viem)  http://127.0.0.1:43173         │
│  - Draft policy → ownerWallet.writeContract(registerPolicy)     │
│  - AgentAccount.signTypedData(AgentAction)                      │
│  - owner relays executeAction (data always 0x in UI)            │
│  - localStorage: one bound policy hash                          │
└────────────┬───────────────────────────────┬────────────────────┘
             │ HTTP /rpc proxy               │ well-known Anvil keys
             ▼                               ▼
┌─────────────────────┐           ┌──────────────────────────────┐
│ Anvil 31337         │           │ Agent OS (camera fallback)   │
│ BoundWallet         │           │ binance.com/agent-os         │
│ MockRiskOracle      │           │ NOT wired to the wallet      │
│ MockERC20           │           └──────────────────────────────┘
└─────────────────────┘
```

## On-chain objects

| Object | Role |
| --- | --- |
| `owner` (immutable) | Sole `registerPolicy` caller. `revokePolicy` allowed if `msg.sender == policy.owner` (set to registrar). |
| `riskOracle` (immutable) | `getLatestRiskScore(agentId)` during `executeAction`. Demo: `MockRiskOracle`. |
| `Policy` | Agent, caps, window, min score, `exists` / `isActive`. Allow/block lists live in side mappings, not in `getPolicy()`. |
| `AgentAction` (EIP-712) | Signed by the agent; bound to `policyHash`, `target`, `value`, `data`, `nonce`, `action`, `entropyCommitment`, and `policy.validUntil`. |
| Relayer | **Anyone** may call `executeAction` with a valid signature. The UI uses the owner key; that is convenience, not an on-chain check. |
| Audit | Hash-chained `AuditEntry` (`previousHash`, entropy, sequence, `sessionId = policyHash`). Appended **after** the inner call. |

## Execution pipeline (`executeAction`)

Order in `src/BoundWallet.sol`:

1. Policy `exists` and `isActive`
2. `block.timestamp` in `[validAfter, validUntil]`
3. Recover EIP-712 signer == `policy.agent`
4. Nonce unused for that `policyHash`
5. `target` not blocked **and** allowlisted
6. `keccak256(action)` in `isAllowedAction`
7. `value <= maxValuePerTx`
8. If `maxValuePerDay > 0`: `spentOnDay[day] + value <= maxValuePerDay` (then increment)
9. `riskOracle.getLatestRiskScore(agentId) <= minVerificationScore` (reject if score **exceeds**)
10. Mark nonce used
11. `target.call{value: value}(data)` — revert on failure (rolls back nonce and spend)
12. Append audit, emit `ActionExecuted`

Checks-effects-interactions for nonce and daily spend happen **before** the external call. Audit is after (does not affect balances).

## Spec gap (documented)

Published ERC-8196 `executeAction` omits `string action` even though EIP-712 `AgentAction` includes it. Bound Wallet adds `action` as a **trailing argument**, hashes it into the typed data, and string-matches `allowedActions`. It does **not** decode `data` to prove the call is a transfer.

## What this is not

- Not ERC-4337 AA (`IAccount`)
- Not a general session-key module with per-selector spending
- Not a live Agent OS permission bus
- Not upgradeable; no `initialize`, no admin besides `owner`
