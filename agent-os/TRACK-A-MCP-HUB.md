# Track A — Agent OS MCP hub (camera)

Binance Agent OS Track A beat: **assign → bind → act → revoke**.

Agent OS and Bound Wallet are **two permission planes** (Zodiac module vs modifier). Only the on-chain plane stops `executeAction`. See [TRUST.md](../TRUST.md).

MCP may be connected for live Agent OS assign/revoke. There is still **no** code path from Agent OS → `BoundWallet`. Prefer a real MCP cut for shots 1 and 5; the UI **Mark assigned** toggle is an honest camera control when MCP is not in the frame.

## Intent

Show a judge, in one continuous take:

1. Agent OS is **assigned** (MCP or UI toggle). Bound Wallet banner: *Assigned off-chain. Not bound.*
2. Owner **binds** the grant card on-chain as an ERC-8196 policy.
3. The agent **acts in-policy** (under the cap).
4. An **out-of-policy** act reverts.
5. Optional: MOCK transfer (ETH + MOCK grant) and/or **Reveal last entropy**.
6. Owner **revokes on-chain** (or **Panic revoke-all**). Banner: *Agent OS still assigned. Policy revoked. Spend is dead.*

Do **not** narrate Agent OS revoke as if it were `revokePolicy`.

## What is real vs fallback

| Beat | Real now | Fallback |
|------|----------|----------|
| Policy bind / execute / revoke | Anvil Bound Wallet UI | — |
| Agent OS assign / revoke | MCP camera if connected | UI **Mark assigned** (does not call Binance) and/or screen recording of [binance.com/agent-os](https://www.binance.com/agent-os) |
| Live CEX orders | **Out of scope** | Do not demo trading |

## Shot list

Record 1080p. Hold each card 3–5 seconds. Narrate in plain language — no hex dumps as the primary frame.

### 1. Assign

- Optional: open [https://www.binance.com/agent-os](https://www.binance.com/agent-os), show a subaccount permission grant.
- Bound Wallet: **Mark assigned**. Hold the dual-plane cards. Banner must read **Assigned off-chain. Not bound.**
- Say: “We assign the agent off-chain. That does not move funds. Next we bind the same idea on-chain.”

### 2. Bind

- Local: `anvil`, `./script/deploy-anvil.sh`, `cd ui && npm run dev`
- Load addresses if needed.
- Grant card defaults are fine: `transfer`, 1 ETH / tx, recipient allowlisted, mock score ≤ 20. **ETH + MOCK** allowlists the token too. **Tight session** is 0.1 ETH / 1 hour.
- **Bind on-chain as Owner.** Hold policyHash (short label + copyable hash), cap, expiry.

### 3. In-policy act

- Simulate agent: `0.1` ETH, allowlisted recipient.
- Activity log: sequence 1, genesis previous hash.
- Optional: **Reveal last entropy** (audit check, not a TEE). Refresh keeps the last unrevealed secret and the next unused nonce.
- Narrate: “In policy. Under the cap.”

### 4. Out-of-policy revert

- Amount `2` ETH. Preview warns; execute reverts; nonce not consumed.
- Optional: write mock risk above 20, retry `0.1` ETH.
- Optional: Asset **MockERC20**, `0.1` MOCK, if the bound grant allowlisted the token.

### 5. Revoke on-chain (leave Agent OS assigned)

- **Revoke on-chain (Agent OS unchanged)** or **Panic revoke-all** (every active hash).
- Status Revoked.
- Banner: **Agent OS still assigned. Policy revoked. Spend is dead.**
- Optional extra cut: revoke on Agent OS too, and say it still was not the kill switch.

## Voiceover (short)

Assign on Agent OS. Bind the same limit on-chain. Agent transfers in policy. Over-cap reverts. Owner revokes the policyHash (or panic-all). Agent OS can still look assigned. The agent never had the owner key.

## Later: real MCP

Replace the Binance.com cut with MCP assign/revoke tool calls. Keep Bound Wallet bind / act / revoke. Still no live CEX trading in this repo. MCP tools are not the wallet’s kill switch.
