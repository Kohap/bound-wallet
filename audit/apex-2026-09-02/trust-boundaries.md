# Trust boundaries

```
                    untrusted                         trusted at register
                         │                                    │
     Agent key ──────────┤                                    │
     Relayer / mempool ──┤                                    │
     Host / LLM ─────────┤         Owner EOA ─────────────────┤
     UI / browser ───────┤         Policy blob (immutable) ───┤
     Agent OS (unwired) ─┤         Oracle address (immutable) ┤
                         │                                    │
                         ▼                                    ▼
              executeAction signature            registerPolicy / revokePolicy
              target.call(data)                  allow/block lists, caps, window
```

## Actors

| Actor | Trust | Can do | Cannot do |
| --- | --- | --- | --- |
| **Owner EOA** | Trusted to set policy. Footguns are owner risk. | Register N policies, revoke per hash, write mock oracle (UI), fund wallet | Bypass a live policy without revoke/expiry |
| **Agent EOA** | Untrusted. This is the threat the policy exists for. | Sign `AgentAction`; self-relay if it has gas | `registerPolicy` / `revokePolicy` (`msg.sender` checks) |
| **Relayer** | Untrusted | Submit a valid signature | Change `target`/`value`/`data`/`action` without invalidating the sig |
| **Permission UI** | **Not a security boundary** | Convenience preview, one localStorage policy | Enforce caps (chain does) |
| **MockRiskOracle** | Untrusted in code (`setScore` has no `onlyOwner`) | Anyone on Anvil can set scores | N/A — documented mock |
| **Allowlisted target** | Fully trusted for the inner `call` | Any code path the contract exposes | N/A |
| **Agent OS** | Independent product UI | Camera “assign/revoke” | Zero effect on `BoundWallet` |

## Boundary claims the UI makes vs chain

| Claim | On-chain |
| --- | --- |
| “Agent never holds the owner key” | True: `owner` immutable; agent only in `Policy.agent` |
| “Owner relays `executeAction`” | False as enforcement: any `msg.sender` may relay |
| “Maps 1:1 to ERC-8196” | Mostly; extra trailing `action`; no 4337; entropy stub |
| “Asset: Native ETH” (seal) | Always shown; chain can still `call` allowlisted contracts with `data` |
| “This policy is revoked. The agent cannot move funds.” | Over-claim if another policy remains `isActive` |
| Track A assign/revoke on Binance | Not a boundary of this contract |

## Trust the owner at registration

`agentId` is not bound to `agent` beyond owner input. Oracle lookup is by `agentId` only. A malicious owner can point `agentId` at a low mock score. Out of threat model for “compromised agent, honest owner.”

## What is *not* a trust boundary

- `allowedActions` string, unless calldata is decoded (it is not)
- UI preview warnings (subset of chain checks; missing allowlist/action/nonce)
- `localStorage` policy copy (`getPolicy` returns only agent, owner, maxTx, validUntil, isActive)
- Hash-chained audit (forensics; does not constrain transfers)
- Entropy commitment (stored, never revealed/verified)
