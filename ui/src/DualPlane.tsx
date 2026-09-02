import { type Address } from "viem";
import {
  type ChainPlane,
  type GrantDraft,
  type Mismatch,
  type OsPlane,
  grantLines,
  planeMismatch,
} from "./lib/planes";
import { policyLabel, shortHash } from "./lib/format";

type Props = {
  os: OsPlane;
  onOs: (next: OsPlane) => void;
  chain: ChainPlane;
  policyHash?: `0x${string}`;
  draft: GrantDraft;
  owner: Address;
  agent: Address;
  canBind: boolean;
  busy: string | null;
  onBind: () => void;
  bindHint?: string;
};

export function DualPlaneBoard({
  os,
  onOs,
  chain,
  policyHash,
  draft,
  owner,
  agent,
  canBind,
  busy,
  onBind,
  bindHint,
}: Props) {
  const mismatch: Mismatch = planeMismatch(os, chain);
  const bannerClass =
    mismatch.tone === "ok"
      ? "border-ok/40 text-ok"
      : mismatch.tone === "bad"
        ? "border-bad/40 text-bad"
        : mismatch.tone === "warn"
          ? "border-warn/40 text-warn"
          : "border-rule text-mute";

  const lines = grantLines(draft);
  const bindDisabled = busy !== null || !canBind;
  const bindLabel =
    busy === "register" ? "Binding…" : chain === "active" ? "Already bound" : "Bind on-chain as Owner";

  return (
    <section className="mb-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <p className="text-xs tracking-[0.18em] text-copper uppercase">Agent OS · off-chain</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl text-cream">Assign</h2>
            <PlanePill
              live={os === "assigned"}
              liveLabel="Assigned"
              deadLabel="Unassigned"
            />
          </div>
          <p className="mt-2 text-sm text-mute">
            Control plane. Zodiac <span className="text-cream">module</span> analogue. Assigning here
            does not register a policy and cannot stop <span className="font-mono text-cream">executeAction</span>.
          </p>
          <p className="mt-2 font-mono text-xs break-all text-mute">Agent {shortHash(agent, 4, 4)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-copper"
              disabled={os === "assigned"}
              onClick={() => onOs("assigned")}
            >
              Mark assigned
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={os === "unassigned"}
              onClick={() => onOs("unassigned")}
            >
              Mark unassigned
            </button>
          </div>
          <p className="mt-3 text-xs text-mute">
            Camera control for the Track A take. This toggle does not call Binance and does not
            touch Bound Wallet.
          </p>
        </article>

        <article className="card">
          <p className="text-xs tracking-[0.18em] text-copper uppercase">Bound Wallet · on-chain</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="font-serif text-2xl text-cream">Bind</h2>
            <PlanePill
              live={chain === "active"}
              liveLabel="Bound"
              deadLabel={chain === "revoked" ? "Revoked" : "Unbound"}
              revoked={chain === "revoked"}
            />
          </div>
          <p className="mt-2 text-sm text-mute">
            Modifier. Holds the caps. Owner key {shortHash(owner, 4, 4)} registers and revokes.
            The agent never holds this key.
          </p>
          <p className="mt-2 font-mono text-xs break-all text-mute">
            {policyHash ? policyLabel(policyHash) : "No policyHash yet"}
          </p>
          <p className="mt-3 text-xs text-mute">
            Revoke on this plane leaves Agent OS looking assigned. That mismatch is the product.
          </p>
        </article>
      </div>

      <div className={`rounded-xl border bg-paper px-4 py-3 ${bannerClass}`} role="status">
        <p className="font-medium">{mismatch.title}</p>
        <p className="mt-1 text-sm opacity-90">{mismatch.body}</p>
      </div>

      <article className="card">
        <p className="text-xs tracking-[0.18em] text-copper uppercase">Grant · ERC-7715 shape</p>
        <h2 className="font-serif text-2xl text-cream">Allow this agent</h2>
        <p className="mt-1 text-sm text-mute">
          One human-readable permission, then a single Owner bind. Same bytes as{" "}
          <span className="font-mono text-cream">registerPolicy</span>. Not a second policy.
        </p>
        <p className="mt-4 text-sm text-cream">
          Allow Agent {shortHash(draft.agent || agent, 4, 4)}
          {draft.agentId ? ` · id ${draft.agentId}` : ""} to:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-cream">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {bindHint && <p className="mt-3 text-sm text-warn">{bindHint}</p>}
        <button
          type="button"
          className="btn btn-copper mt-4"
          disabled={bindDisabled}
          onClick={onBind}
        >
          {bindLabel}
        </button>
      </article>
    </section>
  );
}

function PlanePill({
  live,
  liveLabel,
  deadLabel,
  revoked,
}: {
  live: boolean;
  liveLabel: string;
  deadLabel: string;
  revoked?: boolean;
}) {
  const cls = live
    ? "bg-ok/15 text-ok"
    : revoked
      ? "bg-bad/15 text-bad"
      : "bg-rule/40 text-mute";
  return (
    <span className={`rounded-full px-3 py-1 text-xs ${cls}`}>{live ? liveLabel : deadLabel}</span>
  );
}
