# Internal notes (not for Xira High/Critical relay)

Medium / Low / QA. Do not promote without a new evidence bar.

- Preview warnings skip action allowlist, target allowlist, blocked list, nonce-used.
- `getPolicy` omits allowlists, `maxValuePerDay`, `minVerificationScore`, `validAfter`; UI trusts localStorage for those.
- Policy editor remains editable after bind; does not mutate chain (immutable) — confusion risk.
- Register button not disabled when a policy is already bound (see OPEN H14).
- `Number(maxValuePerDay)` in UI is unsafe for huge strings; demo uses small ETH amounts.
- `parseAddressList` type-asserts before `getAddress` (register still checksums).
- Audit entry does not store `data` / `target` / `value` (events do for target/value).
- No IERC-1271; contract agents cannot sign.
- No compact (EIP-2098) signatures; length must be 65.
- `minVerificationScore` name vs “reject if score exceeds” is easy to misread; UI copy is actually correct.
- `sessionId := policyHash` is not a session in the ERC-4337 sense.
- Foundry `via_ir = true`; coverage needs `--ir-minimum`.
- Local checkout at review start had incomplete vendored `forge-std`; `origin/main` CI now installs v1.16.2. Not a wallet bug.
- Identity copy “this key cannot register” is true on-chain; good.
- Consider listing active policies from `PolicyRegistered` logs in the UI before any non-demo use.
- If ERC-20 remains a feature, decode `transfer(address,uint256)`, require `to` allowlisted, and meter `amount` against the same caps (or a separate token cap). That is a product change, not a confirmed incident.
