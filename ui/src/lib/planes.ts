import { formatWhen, fromDatetimeLocalOrZero, parseActionList, shortHash, toDatetimeLocal } from "./format";

export type OsPlane = "unassigned" | "assigned";

export type ChainPlane = "unbound" | "active" | "revoked";

export type Mismatch = {
  tone: "ok" | "warn" | "bad" | "mute";
  title: string;
  body: string;
};

export const OS_STORAGE_KEY = "bound-wallet-os-plane";

export function chainPlane(bound: boolean, isActive: boolean): ChainPlane {
  if (!bound) return "unbound";
  return isActive ? "active" : "revoked";
}

/** Zodiac-shaped split: Agent OS is the module control plane; Bound Wallet is the modifier. */
export function planeMismatch(os: OsPlane, chain: ChainPlane): Mismatch {
  if (os === "assigned" && chain === "unbound") {
    return {
      tone: "warn",
      title: "Assigned off-chain. Not bound.",
      body: "Agent OS assignment does not move funds. Until Owner binds an on-chain policy, executeAction has nothing to authorize. The agent cannot spend.",
    };
  }
  if (os === "assigned" && chain === "revoked") {
    return {
      tone: "bad",
      title: "Agent OS still assigned. Policy revoked. Spend is dead.",
      body: "On-chain revokePolicy does not ask Agent OS to cooperate. Assignment can still look live. Only the Bound Wallet plane stops executeAction.",
    };
  }
  if (os === "unassigned" && chain === "active") {
    return {
      tone: "warn",
      title: "Bound on-chain. Agent OS not assigned.",
      body: "Spend still works. Agent OS is not the kill switch — yanking the off-chain assignment leaves the policyHash active.",
    };
  }
  if (os === "assigned" && chain === "active") {
    return {
      tone: "ok",
      title: "Both planes live.",
      body: "Assigned on Agent OS, bound on-chain. Only the on-chain policy caps, allowlists, and revoke stop executeAction.",
    };
  }
  if (os === "unassigned" && chain === "revoked") {
    return {
      tone: "mute",
      title: "Both planes quiet.",
      body: "No Agent OS assignment and no active policyHash. The agent cannot spend.",
    };
  }
  return {
    tone: "mute",
    title: "Neither plane is live.",
    body: "Mark Agent OS assigned (camera), then Bind on-chain as Owner. Two permission planes. Do not merge them.",
  };
}

export type GrantDraft = {
  agent: string;
  agentId: string;
  allowedActions: string;
  allowedContracts: string;
  maxValuePerTx: string;
  maxValuePerDay: string;
  validUntil: string;
  minVerificationScore: string;
};

export function grantLines(draft: GrantDraft): string[] {
  const actions = parseActionList(draft.allowedActions);
  const action = actions[0] ?? "transfer";
  const actionExtra = actions.length > 1 ? ` (+${actions.length - 1} more)` : "";
  const day =
    draft.maxValuePerDay.trim() && Number(draft.maxValuePerDay) > 0
      ? `, ${draft.maxValuePerDay} ETH / day`
      : ", no daily cap";
  const until = formatWhen(fromDatetimeLocalOrZero(draft.validUntil));
  const tokens = draft.allowedContracts.trim().split(/[\s,]+/).filter(Boolean);
  const recipient = tokens[0];
  const more = tokens.slice(1);
  let recipientLabel = recipient
    ? /^0x[0-9a-fA-F]{40}$/.test(recipient)
      ? `only to ${shortHash(recipient, 4, 4)}`
      : "recipient allowlist is not a 20-byte address"
    : "no recipient allowlisted yet";
  if (more.length === 1 && /^0x[0-9a-fA-F]{40}$/.test(more[0])) {
    recipientLabel += ` and token ${shortHash(more[0], 4, 4)}`;
  } else if (more.length > 1) {
    recipientLabel += ` (+${more.length} more)`;
  }
  return [
    `${action}${actionExtra} ≤ ${draft.maxValuePerTx || "0"} ETH per tx${day}`,
    recipientLabel,
    `until ${until}`,
    `while mock risk ≤ ${draft.minVerificationScore || "0"}`,
  ];
}

export type GrantTemplateId = "eth" | "token" | "tight";

export function applyGrantTemplate(
  id: GrantTemplateId,
  ctx: { recipient: string; token?: string; now: number },
): {
  allowedActions: string;
  allowedContracts: string;
  maxValuePerTx: string;
  maxValuePerDay: string;
  validAfter: string;
  validUntil: string;
  minVerificationScore: string;
} {
  const hours = id === "tight" ? 1 : 30 * 24;
  return {
    allowedActions: "transfer",
    allowedContracts:
      id === "token" && ctx.token ? `${ctx.recipient}\n${ctx.token}` : ctx.recipient,
    maxValuePerTx: id === "tight" ? "0.1" : "1",
    maxValuePerDay: id === "tight" ? "0.3" : "5",
    validAfter: toDatetimeLocal(ctx.now - 60),
    validUntil: toDatetimeLocal(ctx.now + hours * 3600),
    minVerificationScore: "20",
  };
}
