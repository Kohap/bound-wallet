# Track A trust note

Bound Wallet is an **Anvil-only demo** (chainId 31337). It is not a production wallet, not a live Agent OS permission bus, and not an ERC-8004 implementation.

## What is on-chain vs off-chain

| Surface | Where it lives | What it actually is |
| --- | --- | --- |
| Bound Wallet `registerPolicy` / `executeAction` / `revokePolicy` | On-chain (Anvil) | ERC-8196-shaped policy module. Caps, allowlists, nonce, and revoke are enforced here. |
| Permission UI | Off-chain browser | Convenience. Dual-plane Assign/Bind is **not** a security boundary. Caps are enforced by the contract. |
| Agent OS assign toggle in the UI | Off-chain camera state | Local mark assigned/unassigned for the Track A take. It does **not** call Binance and does **not** register or revoke an on-chain policy. |
| Binance Agent OS (assign / revoke) | Off-chain control plane | MCP may be connected for live Agent OS camera assign/revoke. Assigning or revoking in Agent OS does **not** register or revoke an on-chain policy. |
| Agent OS MCP | Off-chain (may be connected) | Live camera assign/revoke via MCP is allowed. There is still **no** code path from Agent OS → `BoundWallet`. Bound Wallet remains the on-chain execution policy; Agent OS is the off-chain control plane. MCP tools are not the wallet’s kill switch. |

The Track A story is: assign on Agent OS (MCP camera if connected, or the UI Assign toggle), **bind the same idea on-chain** as an ERC-8196 policy, act in-policy, revert out-of-policy, owner `revokePolicy` while Agent OS can still look assigned. Those are two permission planes. Only the on-chain plane stops `executeAction`. The desk shows the mismatch on purpose (Zodiac module vs modifier).

## Mock IERC-8126 (risk oracle)

`MockRiskOracle` is a stand-in, not IERC-8126 / ERC-8126 production.

- `setScore` is **owner-only** (the Anvil deployer / UI Owner). Random accounts cannot write scores.
- Unset `agentId`s fail closed: `hasScore` is false and `executeAction` reverts `risk score unset`. An explicit score of `0` is recorded and still passes (lowest risk).
- The oracle address is immutable on `BoundWallet`; swapping in a real verifier is a deploy-time choice, not this mock.

Do not deploy this mock as a live risk gate.

## Entropy stub

`entropyCommitment` is stored on the hash-chained audit entry. **Commit–reveal is stubbed**: there is no reveal, no `EntropyVerificationFailed`, and no host-manipulation mitigation from ERC-8196. Treat the field as an audit annotation for the demo.

## ERC-8004 / production overclaim

This repository:

- Implements an ERC-8196 *hour-1/2* wallet (`IAIAgentAuthenticatedWallet` plus a documented `action` spec gap).
- Does **not** implement ERC-8004. Do not describe Bound Wallet as ERC-8004 Final, ERC-8004 production, or an identity/reputation registry.
- Does **not** implement ERC-4337 account validation (`IAccount` / `validateUserOp`).
- Does **not** wire live CEX trading.

Anvil default keys in the UI and README are **publicly known**. Pointing this stack at a public RPC with those keys is immediate theft.

## ERC-20 metering (decimals)

`maxValuePerTx` / `maxValuePerDay` meter **native `value` plus** decoded ERC-20 `transfer` / `transferFrom` `amount`s when calldata is present. Amounts use the token’s **raw units with no decimal conversion**. That matches wei 1:1 only for **18-decimal** tokens (this repo’s `MockERC20`). Unknown or non-canonical calldata is rejected. Inner ERC-20 recipients must be allowlisted.

## MVP: one focused policyHash in the UI

The contract may hold several active policies. The permission desk focuses **one** `policyHash` in the editor/seal and **lists every on-chain `policyHash`**. Revoke applies only to the selected hash. Do not read one displayed hash as covering every live policy.
