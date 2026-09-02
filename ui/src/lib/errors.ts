import {
  BaseError,
  ContractFunctionRevertedError,
  formatEther,
  type Address,
} from "viem";
import { formatWhen, shortHash } from "./format";

function asBig(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value !== "") {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function explainRevert(err: unknown): string {
  const revert = findRevert(err);
  if (!revert) {
    if (err instanceof Error) return err.message;
    return "The transaction failed.";
  }

  const name = revert.data?.errorName;
  const args = revert.data?.args as unknown[] | undefined;

  if (name === "ValueExceedsLimit") {
    const value = asBig(args?.[0]);
    const max = asBig(args?.[1]);
    const amount = value !== undefined ? `${formatEther(value)} ETH` : "this amount";
    const cap = max !== undefined ? `${formatEther(max)} ETH` : "the policy cap";
    return `This transfer is over the limit. Amount ${amount} exceeds the cap of ${cap}.`;
  }

  if (name === "PolicyExpired") {
    const until = asBig(args?.[1]);
    return `This policy has expired${until !== undefined ? ` (expiry ${formatWhen(until)})` : ""}.`;
  }

  if (name === "InvalidSignature") {
    const recovered = args?.[0] as Address | undefined;
    const expected = args?.[1] as Address | undefined;
    return `The signature is not from the bound agent${
      expected ? ` (expected ${shortHash(expected, 4, 4)}` : ""
    }${recovered ? `, recovered ${shortHash(recovered, 4, 4)}` : ""}${expected ? ")" : ""}.`;
  }

  if (name === "PolicyViolation") {
    const reason = String(args?.[1] ?? "policy violation");
    return plainViolation(reason);
  }

  if (revert.reason) return revert.reason;
  return name ? `The wallet rejected this action (${name}).` : "The wallet rejected this action.";
}

function plainViolation(reason: string): string {
  switch (reason) {
    case "policy not found":
      return "No policy exists for this policy hash.";
    case "policy inactive":
      return "This policy has been revoked and can no longer authorize actions.";
    case "policy not yet valid":
      return "This policy is not valid yet (validAfter is still in the future).";
    case "blocked contract":
      return "The target is on the blocked list for this policy.";
    case "target not allowlisted":
      return "The target is not on the allowed list for this policy.";
    case "action not allowed":
      return "That action is not in the policy’s allowed actions.";
    case "nonce already used":
      return "This nonce was already used. Choose a new nonce for a new action.";
    case "risk score exceeds threshold":
      return "The mock risk score is above the policy threshold, so the wallet rejected the action.";
    case "risk score unset":
      return "No mock risk score is recorded for this agent id, so the wallet rejected the action.";
    case "not owner":
      return "Only the owner can register or revoke a policy. The agent cannot.";
    case "execution failed":
      return "The inner call failed (for example the vault has too little ETH).";
    case "unmeterable calldata":
      return "Calldata is not a standard ERC-20 transfer or transferFrom, so the wallet cannot meter it.";
    case "recipient not allowlisted":
      return "The ERC-20 recipient is not on the allowed list for this policy.";
    default:
      return `The policy blocked this action (${reason}).`;
  }
}

function findRevert(err: unknown): ContractFunctionRevertedError | undefined {
  if (err instanceof ContractFunctionRevertedError) return err;
  if (err instanceof BaseError) {
    const walked = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (walked instanceof ContractFunctionRevertedError) return walked;
  }
  return undefined;
}
