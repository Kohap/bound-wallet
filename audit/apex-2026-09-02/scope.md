# Scope

**Review:** Apex Sentinel–style self-check of Bound Wallet (Xira product).  
**Date:** 2026-09-02  
**Mode:** `READ_ONLY_PRODUCTION`  
**Live:** **NO**  
**Broadcast:** none (no mainnet, no public testnet, no Track A submission)  
**Owner product self-check:** yes (not a third-party contest submission)

## In scope

| Surface | Path | Why |
| --- | --- | --- |
| ERC-8196 wallet | `src/BoundWallet.sol` | Policy register / execute / revoke; EIP-712 `AgentAction`; native call |
| Interface / spec gap | `src/interfaces/IAIAgentAuthenticatedWallet.sol` | Trailing `string action` vs published `executeAction` |
| Mocks (as deployed) | `src/mocks/MockRiskOracle.sol`, `src/mocks/MockERC20.sol` | What the Anvil demo actually wires |
| Permission UI | `ui/src/App.tsx` + `ui/src/lib/*` | Prompt copy vs on-chain args; register/simulate/revoke |
| Tests as evidence | `test/BoundWallet.t.sol` | 14 unit tests; used as runtime evidence, not trusted as a proof of absence |
| Track A docs | `agent-os/TRACK-A-MCP-HUB.md` | Trust assumptions for Agent OS assign/revoke |
| Deploy | `script/Deploy.s.sol`, `script/deploy-anvil.sh` | Funding, token mint, oracle seed |

## Explicitly out of scope (do not treat as production)

- Mainnet / public testnet deploy
- Live Binance CEX, Agent OS MCP, order placement, Track A submission
- Real ERC-8126 / ERC-8004 oracles
- ERC-4337 bundler / `validateUserOp`
- Entropy commit–reveal (documented stub)
- Discord / Telegram
- Inventing or broadcasting fund-moving exploit PoCs

## Environment this review assumes

Anvil `chainId` 31337. Well-known Foundry keys are in the UI on purpose. Findings that only exist if those keys are pointed at a public network are operational misuse, not in-scope High/Critical.

## Evidence bar (this pack)

| Label | Meaning |
| --- | --- |
| **CONFIRMED High/Critical** | Runtime (existing test / `forge test` / `eth_call`) **and** quantified economic bound. None claimed without both. |
| **OPEN** | Hypothesis not killed; not elevated to Confirmed. |
| **KILLED** | False positive, spec-inherent, documented stub, or out of threat model. |
| **Potential** | DESK-only; did not meet Confirmed High/Critical. Medium/Low/QA stay in `internal-notes.md`. |
