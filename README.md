# Bound Wallet

Hour-2 Foundry + permission UI for **ERC-8196: AI Agent Authenticated Wallet** ([Confirmed Final](https://eips.ethereum.org/EIPS/eip-8196)).

The owner registers an **immutable policy**. An AI agent never holds the owner key. `executeAction` succeeds only if an EIP-712 `AgentAction` complies with that policy.

Binance Agent OS Track A + ETHOnline. **Anvil only** (chainId 31337). No Discord/Telegram, no live CEX trading, no mainnet, no trading bot. Agent OS MCP may be used for camera assign/revoke; it still does not call Bound Wallet.

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
TRUST.md     ← Track A trust: mock 8126, entropy stub, MCP vs chain, Anvil, no ERC-8004
README.md
```

## Spec gap (executeAction / `action`)

Published `IAIAgentAuthenticatedWallet.executeAction` omits `string action`, but EIP-712 `AgentAction` requires it.

Bound Wallet **adds `string action` as a trailing argument** to `executeAction`, hashes it into the typed data, and reverts `PolicyViolation` if it is not in `allowedActions`.

`transfer` maps to native ETH (`target.call{value: value}("")`) and/or an ERC-20 `transfer` / `transferFrom` encoded in `data`.

**ERC-20 metering:** if `data` is non-empty, it must be a canonical ABI-encoded `transfer(address,uint256)` or `transferFrom(address,address,uint256)`. The decoded token `amount` is added to native `value` and checked against the same `maxValuePerTx` / `maxValuePerDay`. Amounts are **raw token units with no decimal conversion** (1:1 with wei only for 18-decimal tokens such as `MockERC20`). Unknown or padded calldata is rejected. The inner ERC-20 recipient must be allowlisted.

See [TRUST.md](TRUST.md) for Track A trust boundaries (mock IERC-8126, entropy stub, Agent OS MCP off-chain vs Bound Wallet on-chain, Anvil-only, no ERC-8004 Final/production claim).

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

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation). `forge-std` is a git submodule at `lib/forge-std` (tag `v1.16.2`). Clone with `--recurse-submodules` or run `git submodule update --init --recursive`.

```bash
forge test
```

Hour-1 suite plus ERC-20 metering, fail-closed oracle, and admin/revert regressions. Keep them green when changing anything except `ui/`.

## Permission UI

```bash
anvil
./script/deploy-anvil.sh
cd ui && npm install && npm run dev
```

UI: [http://127.0.0.1:43173](http://127.0.0.1:43173)

`deploy-anvil.sh` deploys MockRiskOracle + BoundWallet + MockERC20, funds the wallet with 10 ETH, sets mock risk to 5, and writes `ui/.env.local`. Restart `npm run dev` after deploy so Vite picks up env. You can also paste the three addresses in the UI.

The UI talks to Anvil through the Vite `/rpc` proxy (so a hosted preview can reach the local node). Owner and Agent are the two well-known Anvil keys, labeled in plain text. The agent cannot register or revoke.

```bash
cd ui && npm install && npm run build
```

### 3-minute demo path (including Agent OS)

Dual-plane desk: [agent-os/TRACK-A-MCP-HUB.md](agent-os/TRACK-A-MCP-HUB.md). No live CEX trading.

0. **Assign** — In Bound Wallet, **Mark assigned** (camera control; does not call Binance). Optional cut to [binance.com/agent-os](https://www.binance.com/agent-os) for a real subaccount grant, then back.
1. **Mismatch** — Banner: *Assigned off-chain. Not bound. The agent cannot spend.*
2. **Bind** — Leave the grant card defaults (transfer, 1 ETH / tx, 5 ETH / day, recipient allowlisted, mock score ≤ 20). **Bind on-chain as Owner.** Copy the policy hash.
3. **In-policy act** — Simulate agent amount `0.1` ETH. Activity log shows sequence 1.
4. **Out-of-policy revert** — Amount `2` ETH. Wallet reverts; nonce is not consumed.
5. **Revoke** — Owner **Revoke on-chain (Agent OS unchanged)**. Banner: *Agent OS still assigned. Policy revoked. Spend is dead.* Do not treat Agent OS revoke as `revokePolicy`.

## Cast demo (hour 1, still valid)

Terminal 1:

```bash
anvil
```

Terminal 2 — deploy, fund, then the two demo calls:

```bash
export RPC=http://127.0.0.1:8545
export OWNER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export AGENT_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
export OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export AGENT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
export RECIPIENT=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

ORACLE=$(forge create src/mocks/MockRiskOracle.sol:MockRiskOracle \
  --rpc-url $RPC --private-key $OWNER_PK --broadcast --json | jq -r .deployedTo)
WALLET=$(forge create src/BoundWallet.sol:BoundWallet \
  --rpc-url $RPC --private-key $OWNER_PK --broadcast --json \
  --constructor-args $ORACLE | jq -r .deployedTo)

cast send $ORACLE "setScore(uint256,uint8)" 1 5 --rpc-url $RPC --private-key $OWNER_PK
cast send $WALLET --value 1ether --rpc-url $RPC --private-key $OWNER_PK
```

### 1. `registerPolicy`

```bash
POLICY_HASH=$(cast send $WALLET \
  "registerPolicy(address,uint256,string[],address[],address[],uint256,uint256,uint256,uint256,uint8)" \
  $AGENT 1 '["transfer"]' "[$RECIPIENT]" "[]" \
  1000000000000000000 0 0 2000000000 20 \
  --rpc-url $RPC --private-key $OWNER_PK --json | jq -r '.logs[0].topics[1]')
echo $POLICY_HASH
```

### 2. Within-cap `executeAction`

Sign an EIP-712 `AgentAction` with the **agent** key, then execute `0.1 ETH` to the recipient (under the 1 ETH tx cap):

```bash
VALID_UNTIL=2000000000
NONCE=1
VALUE=100000000000000000
ENTROPY=0x0000000000000000000000000000000000000000000000000000000000000000

cat > /tmp/agent-action.json <<EOF
{
  "types": {
    "EIP712Domain": [
      {"name":"name","type":"string"},
      {"name":"version","type":"string"},
      {"name":"chainId","type":"uint256"},
      {"name":"verifyingContract","type":"address"}
    ],
    "AgentAction": [
      {"name":"agent","type":"address"},
      {"name":"action","type":"string"},
      {"name":"target","type":"address"},
      {"name":"value","type":"uint256"},
      {"name":"data","type":"bytes"},
      {"name":"nonce","type":"uint256"},
      {"name":"validUntil","type":"uint256"},
      {"name":"policyHash","type":"bytes32"},
      {"name":"entropyCommitment","type":"bytes32"}
    ]
  },
  "primaryType": "AgentAction",
  "domain": {
    "name": "AIAgentAuthenticatedWallet",
    "version": "1",
    "chainId": 31337,
    "verifyingContract": "$WALLET"
  },
  "message": {
    "agent": "$AGENT",
    "action": "transfer",
    "target": "$RECIPIENT",
    "value": "$VALUE",
    "data": "0x",
    "nonce": "$NONCE",
    "validUntil": "$VALID_UNTIL",
    "policyHash": "$POLICY_HASH",
    "entropyCommitment": "$ENTROPY"
  }
}
EOF

SIG=$(cast wallet sign --data --from-file /tmp/agent-action.json --private-key $AGENT_PK)

cast send $WALLET \
  "executeAction(bytes32,address,uint256,bytes,uint256,bytes32,bytes,string)" \
  $POLICY_HASH $RECIPIENT $VALUE 0x $NONCE $ENTROPY $SIG transfer \
  --rpc-url $RPC --private-key $OWNER_PK
```

Confirm the recipient received 0.1 ETH (Anvil accounts start at 10,000 ETH, so this should be `10000.1` ETH):

```bash
cast balance $RECIPIENT --ether --rpc-url $RPC
cast call $WALLET "getPolicy(bytes32)(address,address,uint256,uint256,bool)" $POLICY_HASH --rpc-url $RPC
```

## Out of scope

Discord/Telegram, **live** CEX / Agent OS MCP wiring, real ERC-8126 / ERC-8004, ERC-4337 bundler, entropy reveal, trading, mainnet or public testnet deploy. Agent OS assign/revoke on camera is documented in `agent-os/TRACK-A-MCP-HUB.md` as a fallback only.

This is **not** ERC-8004 Final and **not** a production Agent OS integration. Trust boundaries: [TRUST.md](TRUST.md).

## License

Interface and contracts: [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/), matching ERC-8196.
