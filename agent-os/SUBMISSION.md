# Track A submission kit

Binance Agent OS Mini Hackathon · Track A (AI agent) · ETHOnline.
**Deadline: 8 September 2026 23:59 UTC.**

Repo: https://github.com/Kohap/bound-wallet

Bound Wallet is an **Anvil-only ERC-8196** permission desk. Agent OS assigns (off-chain). Bound Wallet binds (on-chain). The agent never holds the owner key. Only `revokePolicy` / `revokeAll` stop `executeAction`.

## What you still do (cannot be done in this repo)

1. Follow [@Binance](https://x.com/Binance) and **repost** the Agent OS Mini Hackathon post.
2. Record a **≤3 minute** 1080p take using the shot list in [TRACK-A-MCP-HUB.md](TRACK-A-MCP-HUB.md).
3. Reply or quote-repost with: this GitHub URL + the video.
4. Complete the official survey (link is in the Binance announcement).

Do not wait for a live CEX, ERC-8004, or MCP→wallet wiring. Those are out of scope on purpose.

## Voiceover (read this)

Assign on Agent OS. Bind the same limit on-chain. Agent transfers in policy. Over-cap reverts. Owner revokes the policyHash (or panic-all). Agent OS can still look assigned. The agent never had the owner key.

## Demo path (hold each card 3–5s)

0. Optional cut: [binance.com/agent-os](https://www.binance.com/agent-os) subaccount grant, then back.
1. **Mark assigned.** Banner: *Assigned off-chain. Not bound.*
2. Grant defaults (ETH pay) or **ETH + MOCK**. **Bind on-chain as Owner.** Copy policyHash.
3. Simulate **0.1 ETH**. Activity seq 1. Optional **Reveal last entropy** (say “audit check, not a TEE”).
4. Amount **2 ETH** — reverts, nonce not consumed.
5. **Revoke on-chain (Agent OS unchanged)** or **Panic revoke-all.** Banner: *Agent OS still assigned. Policy revoked. Spend is dead.*

Do **not** narrate Agent OS revoke as `revokePolicy`.

## Honesty (say this if a judge asks)

| Claim | Truth |
| --- | --- |
| ERC-8196 Bound Wallet | Yes (plus documented `executeAction` `action` spec gap) |
| Dual-plane Assign / Bind | Yes (Zodiac module vs modifier). UI toggle is camera, not Binance. |
| Kill switch | On-chain `revokePolicy` / `revokeAll`. Agent OS is not it. |
| `revokeAll` | Bound Wallet extension, not ERC-8196 |
| Entropy | Audit commit–reveal. **Not** host-manipulation protection |
| IERC-8126 | `MockRiskOracle` only. Unset scores fail closed |
| ERC-8004 | **No** |
| Live CEX / MCP → BoundWallet | **No** |
| Network | Anvil 31337 only. Default keys are public |

Full boundaries: [TRUST.md](../TRUST.md).
