# Bound Wallet

Hour-2 Foundry + permission UI for **ERC-8196: AI Agent Authenticated Wallet** ([Confirmed Final](https://eips.ethereum.org/EIPS/eip-8196)).

The owner registers an **immutable policy**. An AI agent never holds the owner key. `executeAction` succeeds only if an EIP-712 `AgentAction` complies with that policy.

Binance Agent OS Track A + ETHOnline. **Anvil only** (chainId 31337). No Discord/Telegram, no live CEX/Agent OS wiring, no mainnet, no trading bot.

## Layout

```
src/BoundWallet.sol
src/interfaces/IAIAgentAuthenticatedWallet.sol
src/mocks/MockRiskOracle.sol
src/mocks/MockERC20.sol
test/BoundWallet.t.sol
script/Deploy.s.sol
script/deploy-anvil.sh
ui/          ← Vite + React + viem permission desk
agent-os/TRACK-A-MCP-HUB.md  ← Agent OS camera fallback (assign→act→revoke)
README.md
```

## Spec gap (executeAction / `action`)

Published `IAIAgentAuthenticatedWallet.executeAction` omits `string action`, but EIP-712 `AgentAction` requires it.

Bound Wallet **adds `string action` as a trailing argument** to `executeAction`, hashes it into the typed data, and reverts `PolicyViolation` if it is not in `allowedActions`.

`transfer` maps to native ETH (`target.call{value: value}("")`) and/or an ERC-20 `transfer` encoded in `data`.

## Entropy

`entropyCommitment` is stored on the hash-chained audit entry. **Commit-reveal is stubbed** (no reveal, no `EntropyVerificationFailed`).

## Anvil only

Do not point these contracts at a public network. Anvil default keys below are publicly known.

| Role      | Address                                      | Private key |
|-----------|----------------------------------------------|-------------|
| Owner     | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Agent     | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Recipient | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | — |

## Tests

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation). `forge-std` is vendored at `lib/forge-std` (no git submodule).

```bash
forge test
```

Hour-1 suite: 14 tests. Keep them green when changing anything except `ui/`.
