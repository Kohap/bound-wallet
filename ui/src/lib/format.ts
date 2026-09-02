import { formatEther, getAddress, isAddress, type Address } from "viem";

export function shortHash(value: string, head = 6, tail = 4): string {
  if (value.length < head + tail + 2) return value;
  return `${value.slice(0, head + 2)}…${value.slice(-tail)}`;
}

export function policyLabel(policyHash: string): string {
  return `policyHash ${shortHash(policyHash)}`;
}

export function formatEth(value: bigint): string {
  const asEth = formatEther(value);
  const n = Number(asEth);
  if (!Number.isFinite(n)) return `${asEth} ETH`;
  if (n === 0) return "0 ETH";
  if (n >= 1) return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`;
  return `${asEth} ETH`;
}

export function formatWhen(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function toDatetimeLocal(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): number {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) throw new Error("Enter a valid date and time.");
  return Math.floor(ms / 1000);
}

/** Render-safe: invalid / empty datetime-local becomes 0 instead of throwing. */
export function fromDatetimeLocalOrZero(value: string): number {
  try {
    return fromDatetimeLocal(value);
  } catch {
    return 0;
  }
}

export function parseAddressList(raw: string): Address[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s): s is Address => /^0x[0-9a-fA-F]{40}$/.test(s));
}

/** Fail closed: leftover tokens that are not 20-byte addresses throw. */
export function parseAddressListStrict(raw: string): Address[] {
  const tokens = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: Address[] = [];
  for (const token of tokens) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(token)) {
      throw new Error(`Not a 20-byte address: ${token}`);
    }
    out.push(getAddress(token));
  }
  return out;
}

export function parseActionList(raw: string): string[] {
  return raw
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function safeAddress(value: string, fallback: Address): Address {
  try {
    return isAddress(value) ? getAddress(value) : fallback;
  } catch {
    return fallback;
  }
}

export function dayBucket(nowSeconds: bigint): bigint {
  return nowSeconds / 86400n;
}

export function riskBadge(
  score: number,
  threshold: number,
  scoreSet = true,
): { label: string; tone: "ok" | "warn" | "bad" } {
  if (!scoreSet) return { label: "Unset · fail closed", tone: "bad" };
  if (score > threshold) return { label: "Would reject", tone: "bad" };
  if (score === 0) return { label: "Lowest risk", tone: "ok" };
  if (score <= 20) return { label: "Low risk", tone: "ok" };
  return { label: "Near threshold", tone: "warn" };
}

export function actionInEnglish(action: string): string {
  const key = action.trim().toLowerCase();
  if (key === "transfer") {
    return "Transfer (native ETH via value, and/or ERC-20 transfer/transferFrom in data)";
  }
  if (key === "swap") return "Swap (not enabled unless listed in the policy)";
  return action.trim() || "Untitled action";
}
