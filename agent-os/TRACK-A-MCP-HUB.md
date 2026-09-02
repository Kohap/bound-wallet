# Track A — Agent OS MCP hub (camera fallback)

Binance Agent OS Track A beat: **assign → act → revoke**.

This file is the **camera fallback** until a real Agent OS MCP connection exists. It does **not** wire live CEX trading, order placement, or production Agent OS APIs. Prefer a real MCP later; this shot list is acceptable for the hour-2 demo script.

## Intent

Show a judge, in one continuous take:

1. An Agent OS subaccount is **assigned** a permission.
2. Bound Wallet **binds** that same idea on-chain as an ERC-8196 policy.
3. The agent **acts in-policy** (under the cap).
4. An **out-of-policy** act reverts.
5. The owner **revokes** (Bound Wallet `revokePolicy`, optional Binance revoke on camera).

The Track A story is: show assignment on Agent OS, **bind the same idea on-chain** as an ERC-8196 policy, act in-policy, revert out-of-policy, owner `revokePolicy`. Agent OS and Bound Wallet are **two permission planes**. Only the on-chain plane stops `executeAction`. See [TRUST.md](../TRUST.md).

## What is real vs fallback

| Beat | Real now | Fallback (this file) |
|------|----------|----------------------|
| Policy register / execute / revoke | Anvil Bound Wallet UI | — |
| Agent OS assign / permission / revoke | — | Screen recording of [binance.com/agent-os](https://www.binance.com/agent-os) |
| Live CEX orders | **Out of scope** | Do not demo trading |

When a real MCP exists, replace the Binance.com cuts with live assign/revoke tool calls. Keep the Bound Wallet cuts.

## Shot list (assign → act → revoke)

Record 1080p. Hold each card 3–5 seconds. Narrate in plain language (policy hash, amount, expiry, remaining, revoke) — no hex dumps as the primary frame.

### 1. Open Agent OS — assign

- Open [https://www.binance.com/agent-os](https://www.binance.com/agent-os).
- Show a **subaccount** (or agent identity) and a **permission** grant: what the agent may do, a cap or scope if the UI shows one, and that this is assignment, not a trade.
- Say on camera: “We assign the agent a limited permission. Next we bind that permission on-chain so it can execute without the owner key.”

### 2. Cut to Bound Wallet — register policy

- Local: `anvil`, `./script/deploy-anvil.sh`, `cd ui && npm run dev` → http://127.0.0.1:43173
- Owner account visible: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Agent account visible: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (signer only, not admin)
- Register ERC-8196 policy (defaults are fine): `transfer`, 1 ETH per transaction, recipient allowlisted, min verification score 20.
- Hold the **policy hash** (short label + full copyable hash), **amount** cap, **expiry**.

### 3. In-policy agent act

- Simulate agent: action `transfer`, amount `0.1` ETH, same allowlisted recipient.
- Plain-language AgentAction preview, then Sign as Agent / Owner relays.
- Activity log: sequence 1, genesis previous hash.
- Narrate: “In policy. Under the cap.”

### 4. Out-of-policy revert

- Amount `2` ETH (over the 1 ETH per-transaction cap).
- Preview should already warn; execute reverts; nonce not consumed.
- Optional extra: write mock risk **above** 20, retry `0.1` ETH, revert on risk.

### 5. Revoke

- Bound Wallet: Owner `revokePolicy` with a reason (containment). Status **Revoked**. Next execute disabled / inactive.
- **Optional Binance revoke:** cut back to Agent OS and revoke the subaccount permission so assign and revoke bookend the same story.
- Do **not** place a live order as the revoke beat.

## Voiceover (short)

Assign on Agent OS. Bind the same limit as an immutable Bound Wallet policy. Agent signs an in-policy transfer. Over-cap reverts. Owner revokes. Agent never had the owner key.

## Later: real MCP

Replace shots 1 and 5 (Binance.com) with MCP tools that assign a subaccount permission and revoke it. Bound Wallet shots 2–4 stay. Still no live CEX trading in this repo.
