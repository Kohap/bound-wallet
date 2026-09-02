# Asset flows

## At deploy (Anvil)

`script/Deploy.s.sol` (owner broadcast):

1. Deploy `MockRiskOracle`, `BoundWallet(oracle)`, `MockERC20`
2. `oracle.setScore(1, 5)`
3. `token.mint(wallet, 1000 ether)` — **1000 MOCK sit in the wallet**
4. Fund wallet with **10 ETH**

Those MOCK tokens are unreachable unless a policy allowlists the token address (default UI policy does not).

## Native ETH (default demo)

```
Owner EOA  --ETH-->  BoundWallet
                         |
                         | executeAction(policyHash, target=recipient, value, data=0x, ...)
                         v
                     recipient EOA
```

- `value` is the ETH moved.
- `maxValuePerTx` / `maxValuePerDay` meter **this `value` only**.
- Default UI allowlist is Anvil account #2 (`0x3C44…93BC`).
- UI simulate path always passes `data: "0x"`.

**Runtime bound (existing tests):** over-cap native transfer reverts `ValueExceedsLimit`; nonce is not consumed (full revert). Daily cap: 1 ETH then another 1 ETH reverts against 1.5 ETH/day.

## ERC-20 (supported in contract + hour-1 test, not in UI simulate)

```
BoundWallet  --call data=transfer(to, amount)-->  MockERC20
                                                      |
                                                      v
                                                   `to` (any address in calldata)
```

- Inner `target` must be the **token contract** (must be allowlisted).
- Token `to` / `amount` live in `data`, **not** in `value`.
- Existing test `test_executeAction_transferWithinCap` moves **25 MOCK** with `value = 0` under `maxValuePerTx = 1 ETH`, `maxValuePerDay = 5 ETH`.

This is the documented README mapping: `transfer` = native `call{value}` and/or ERC-20 `transfer` in `data`. Caps still apply only to native `value`.

## Who can pull funds

| Actor | Path |
| --- | --- |
| Agent (valid policy) | `executeAction` to allowlisted `target` with signed `value`/`data` |
| Owner | Cannot `execute` as owner. Recovery = `registerPolicy` with an agent key the owner controls, then sign as that agent. |
| Agent OS | No on-chain path |
| Random relayer | Can submit an already-signed `AgentAction`; cannot mint a new one without the agent key |

## Value that can leave the wallet (economic envelope)

For a **single active policy** whose `allowedContracts` are **only EOAs**:

- Per tx: `min(maxValuePerTx, wallet ETH balance)` native ETH to those EOAs
- Per UTC day if `maxValuePerDay > 0`: same with the daily meter
- ERC-20: **0** (token not a valid `target`)

If a **contract** (token, router, WETH, smart wallet) is allowlisted:

- Native `value` still capped
- `data` is arbitrary → token amounts, `approve`, or any function on that contract are **not** metered by the ETH caps
- Envelope becomes: remaining ETH caps **plus** balances/approvals of allowlisted contracts

Deploy already places 1000 MOCK in the wallet; that inventory is only in play if the token is allowlisted.
