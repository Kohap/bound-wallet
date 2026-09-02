import { type Address, type Hex, type PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ANVIL_CHAIN_ID = 31337;

/** Well-known Anvil Account #0. Public test key — Anvil only. */
export const OWNER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
/** Well-known Anvil Account #1. Public test key — Anvil only. */
export const AGENT_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

export const OWNER_ACCOUNT: PrivateKeyAccount = privateKeyToAccount(OWNER_KEY);
export const AGENT_ACCOUNT: PrivateKeyAccount = privateKeyToAccount(AGENT_KEY);

export const OWNER_ADDRESS: Address = OWNER_ACCOUNT.address;
export const AGENT_ADDRESS: Address = AGENT_ACCOUNT.address;
export const RECIPIENT_ADDRESS: Address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

export const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
