# Assumptions

If an assumption is false, the corresponding kill/open call changes.

| ID | Assumption | If false |
| --- | --- | --- |
| A1 | Runtime is Anvil 31337 only. Well-known keys in `ui/src/lib/anvil.ts` are acceptable. | Pointing the UI at a public RPC with those keys is immediate theft. Operational, out of this review’s High bar. |
| A2 | `MockRiskOracle` is not a production ERC-8126 verifier. | Unauthenticated `setScore` becomes a live bypass/DoS of the risk gate. |
| A3 | Entropy commit–reveal is a stub (README). | Host-manipulation story in ERC-8196 is unimplemented. |
| A4 | No ERC-4337 bundler / account validation. | AA validation bugs are N/A; this is a plain contract + `executeAction`. |
| A5 | Track A Agent OS is camera fallback, not MCP. | Live assign/revoke would be a second, unsynchronized permission plane. |
| A6 | Owner is honest at `registerPolicy` (sets the bound they intend). | Owner can allowlist a router/token, set `maxValuePerDay = 0`, or register many policies. |
| A7 | ERC-8196 `maxValuePerTx` / `maxValuePerDay` are **native wei on `value`**, not decoded token amounts. | If product intent is “1 ETH-equivalent of any asset,” current metering is insufficient (OPEN H4). |
| A8 | `allowedActions` is a signed label unless an implementation decodes `data`. Bound Wallet does not decode. | If product intent is “`transfer` means ERC-20 `transfer` to allowlisted `to` only,” current code does not implement that (OPEN H3). |
| A9 | Relayer identity is not a security control. | UI copy about “owner relays” is not an invariant. |
| A10 | `getPolicy` is a partial view; full allowlists are public mappings the UI mostly does not re-read. | Second browser / stale localStorage can **display** a narrower policy than chain. Chain still enforces chain state. |
| A11 | Compromised-agent threat, not compromised-owner. | Owner already has a recovery path: register a new agent they control. |
| A12 | Reviewer will not publish fund-moving PoCs. Existing unit tests may be cited as runtime evidence. | — |
