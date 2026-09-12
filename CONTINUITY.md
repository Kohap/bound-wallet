# Continuity (ETHOnline 2026)

Bound Wallet is the **same product** across contests. ETHOnline is a second portal submit of that product — not a new MVP.

## Pre-existing (before / for Binance Agent OS Track A)

- Foundry **ERC-8196** `BoundWallet` + mocks (`MockRiskOracle` IERC-8126 fixture, `MockERC20`)
- Owner permission desk UI (Vite) on **Anvil chainId 31337 only**
- Dual-plane Agent OS story: off-chain assign (MCP or UI **Mark assigned**) vs on-chain bind / revoke (`registerPolicy`, `revokePolicy` / `revokeAll`)
- Entropy **audit commit–reveal** (not a TEE)
- `TRUST.md` honesty boundaries (no ERC-8004 Final, no live CEX / MCP→wallet wiring, no mainnet)
- Contest kits: `agent-os/SUBMISSION.md`, `agent-os/TRACK-A-MCP-HUB.md`

## New for this ETHOnline portal submit

- Contest packaging for ETHOnline (demo video ≤5 min assign→bind→act→revoke, portal copy, this Continuity section)
- No separate product line; no Circle / Hedera product pivot (Ledger = pitch framing only if added later)
- Any UI polish after the demo lands is optional post-submit (vocab steal only — no ERC-7715 RPC).
- Planned (not claimed shipped): optional Ledger-aligned pitch framing and MetaMask Guard Mode–style copy (rolling 24h outflow / human confirm to widen). Do **not** claim these as shipped ETHOnline deliverables until merged.

If a judge asks what changed since Track A: **same Bound Wallet execution-layer policy cage**; ETHOnline adds the portal submission + Continuity disclosure.
