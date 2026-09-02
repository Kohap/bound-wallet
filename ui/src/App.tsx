import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseEther,
  parseEventLogs,
  zeroAddress,
} from "viem";
import { foundry } from "viem/chains";
import { agentActionTypes, boundWalletAbi, eip712Domain, mockRiskOracleAbi } from "./lib/abi";
import {
  AGENT_ACCOUNT,
  AGENT_ADDRESS,
  ANVIL_CHAIN_ID,
  OWNER_ACCOUNT,
  OWNER_ADDRESS,
  RECIPIENT_ADDRESS,
  ZERO_HASH,
} from "./lib/anvil";
import { explainRevert } from "./lib/errors";
import {
  actionInEnglish,
  dayBucket,
  formatEth,
  formatWhen,
  fromDatetimeLocal,
  parseActionList,
  parseAddressList,
  policyLabel,
  riskBadge,
  shortHash,
  toDatetimeLocal,
} from "./lib/format";
import { OS_STORAGE_KEY, chainPlane, type OsPlane } from "./lib/planes";
import { DualPlaneBoard } from "./DualPlane";

type Contracts = {
  wallet: Address;
  oracle: Address;
  token: Address;
};

type PolicyDraft = {
  allowedActions: string;
  allowedContracts: string;
  blockedContracts: string;
  maxValuePerTx: string;
  maxValuePerDay: string;
  validAfter: string;
  validUntil: string;
  minVerificationScore: string;
  agent: string;
  agentId: string;
};

type BoundPolicy = PolicyDraft & {
  policyHash: Hex;
  isActive: boolean;
};

type ChainPolicy = {
  policyHash: Hex;
  agent: Address;
  owner: Address;
  maxValuePerTx: bigint;
  validUntil: bigint;
  isActive: boolean;
};

type ActivityRow = {
  sequence: bigint;
  action: string;
  target: Address;
  value: bigint;
  previousHash: Hex;
  entryId: Hex;
  policyHash: Hex;
};

type Flash = { tone: "ok" | "bad" | "mute"; text: string } | null;

const STORAGE_KEY = "bound-wallet-hour2";

function rpcUrl(): string {
  return import.meta.env.VITE_RPC_URL || "/rpc";
}

function envContracts(): Partial<Contracts> {
  const wallet = import.meta.env.VITE_WALLET_ADDRESS;
  const oracle = import.meta.env.VITE_ORACLE_ADDRESS;
  const token = import.meta.env.VITE_TOKEN_ADDRESS;
  return {
    wallet: wallet && isAddress(wallet) ? getAddress(wallet) : undefined,
    oracle: oracle && isAddress(oracle) ? getAddress(oracle) : undefined,
    token: token && isAddress(token) ? getAddress(token) : undefined,
  };
}

function defaultDraft(): PolicyDraft {
  const now = Math.floor(Date.now() / 1000);
  return {
    allowedActions: "transfer",
    allowedContracts: RECIPIENT_ADDRESS,
    blockedContracts: "",
    maxValuePerTx: "1",
    maxValuePerDay: "5",
    validAfter: toDatetimeLocal(now - 60),
    validUntil: toDatetimeLocal(now + 30 * 24 * 60 * 60),
    minVerificationScore: "20",
    agent: AGENT_ADDRESS,
    agentId: "1",
  };
}

function publicClient() {
  return createPublicClient({ chain: foundry, transport: http(rpcUrl()) });
}

function ownerWallet() {
  return createWalletClient({ account: OWNER_ACCOUNT, chain: foundry, transport: http(rpcUrl()) });
}

export default function App() {
  const seeded = envContracts();
  const [walletInput, setWalletInput] = useState(seeded.wallet ?? "");
  const [oracleInput, setOracleInput] = useState(seeded.oracle ?? "");
  const [tokenInput, setTokenInput] = useState(seeded.token ?? "");
  const [contracts, setContracts] = useState<Contracts | null>(
    seeded.wallet && seeded.oracle && seeded.token
      ? { wallet: seeded.wallet, oracle: seeded.oracle, token: seeded.token }
      : null,
  );

  const [anvilOk, setAnvilOk] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<PolicyDraft>(defaultDraft);
  const [bound, setBound] = useState<BoundPolicy | null>(null);
  const [chainPolicies, setChainPolicies] = useState<ChainPolicy[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [revokeReason, setRevokeReason] = useState("Owner containment — stop this agent now");
  const [vaultEth, setVaultEth] = useState<bigint>(0n);
  const [spentToday, setSpentToday] = useState<bigint>(0n);
  const [chainScore, setChainScore] = useState(5);
  const [scoreSet, setScoreSet] = useState(true);
  const [sliderScore, setSliderScore] = useState(5);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [osPlane, setOsPlane] = useState<OsPlane>(() => {
    try {
      const raw = localStorage.getItem(OS_STORAGE_KEY);
      return raw === "assigned" ? "assigned" : "unassigned";
    } catch {
      return "unassigned";
    }
  });
  const flashRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((next: Flash) => {
    setFlash(next);
    if (!next) return;
    requestAnimationFrame(() => {
      flashRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const [action, setAction] = useState("transfer");
  const [target, setTarget] = useState<string>(RECIPIENT_ADDRESS);
  const [amount, setAmount] = useState("0.1");
  const [nonce, setNonce] = useState("1");

  const loadSaved = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { bound?: BoundPolicy; contracts?: Contracts };
      if (parsed.bound?.policyHash) setBound(parsed.bound);
      const seededNow = envContracts();
      if (parsed.contracts?.wallet && !seededNow.wallet) {
        setContracts(parsed.contracts);
        setWalletInput(parsed.contracts.wallet);
        setOracleInput(parsed.contracts.oracle);
        setTokenInput(parsed.contracts.token);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bound, contracts }));
    } catch {
      /* ignore quota / private mode */
    }
  }, [bound, contracts]);

  useEffect(() => {
    try {
      localStorage.setItem(OS_STORAGE_KEY, osPlane);
    } catch {
      /* ignore quota */
    }
  }, [osPlane]);

  const pingAnvil = useCallback(async () => {
    try {
      const id = await publicClient().getChainId();
      setAnvilOk(id === ANVIL_CHAIN_ID);
    } catch {
      setAnvilOk(false);
    }
  }, []);

  useEffect(() => {
    void pingAnvil();
    const t = setInterval(() => void pingAnvil(), 4000);
    return () => clearInterval(t);
  }, [pingAnvil]);

  const refreshChain = useCallback(async () => {
    if (!contracts) return;
    const client = publicClient();
    try {
      const [bal, has, score, block, registered] = await Promise.all([
        client.getBalance({ address: contracts.wallet }),
        client.readContract({
          address: contracts.oracle,
          abi: mockRiskOracleAbi,
          functionName: "hasScore",
          args: [BigInt(draft.agentId || "1")],
        }),
        client.readContract({
          address: contracts.oracle,
          abi: mockRiskOracleAbi,
          functionName: "getLatestRiskScore",
          args: [BigInt(draft.agentId || "1")],
        }),
        client.getBlock(),
        client.getContractEvents({
          address: contracts.wallet,
          abi: boundWalletAbi,
          eventName: "PolicyRegistered",
          fromBlock: 0n,
        }),
      ]);
      setVaultEth(bal);
      setScoreSet(Boolean(has));
      setChainScore(Number(score));

      const listed: ChainPolicy[] = [];
      for (const ev of registered) {
        const policyHash = ev.args.policyHash;
        if (!policyHash) continue;
        const onChain = await client.readContract({
          address: contracts.wallet,
          abi: boundWalletAbi,
          functionName: "getPolicy",
          args: [policyHash],
        });
        listed.push({
          policyHash,
          agent: onChain[0],
          owner: onChain[1],
          maxValuePerTx: onChain[2],
          validUntil: onChain[3],
          isActive: onChain[4],
        });
      }
      setChainPolicies(listed);

      if (bound) {
        const spent = await client.readContract({
          address: contracts.wallet,
          abi: boundWalletAbi,
          functionName: "spentOnDay",
          args: [bound.policyHash, dayBucket(block.timestamp)],
        });
        setSpentToday(spent);
        const match = listed.find(
          (p) => p.policyHash.toLowerCase() === bound.policyHash.toLowerCase(),
        );
        if (match) {
          setBound((prev) => {
            if (!prev || prev.isActive === match.isActive) return prev;
            return { ...prev, isActive: match.isActive };
          });
        }
      }
    } catch {
      /* keep last good state */
    }
  }, [contracts, draft.agentId, bound?.policyHash]);

  const refreshActivity = useCallback(async () => {
    if (!contracts) return;
    const client = publicClient();
    try {
      const executed = await client.getContractEvents({
        address: contracts.wallet,
        abi: boundWalletAbi,
        eventName: "ActionExecuted",
        fromBlock: 0n,
      });
      const logged = await client.getContractEvents({
        address: contracts.wallet,
        abi: boundWalletAbi,
        eventName: "AuditEntryLogged",
        fromBlock: 0n,
      });
      const byId = new Map(logged.map((l) => [l.args.entryId, l]));
      const rows: ActivityRow[] = [];
      for (const ev of executed) {
        const entryId = ev.args.auditEntryId;
        if (!entryId) continue;
        const audit = await client.readContract({
          address: contracts.wallet,
          abi: boundWalletAbi,
          functionName: "getAuditEntry",
          args: [entryId],
        });
        const loggedEv = byId.get(entryId);
        rows.push({
          sequence: audit[2],
          action: loggedEv?.args.actionType ?? "action",
          target: ev.args.target as Address,
          value: ev.args.value ?? 0n,
          previousHash: audit[0],
          entryId,
          policyHash: ev.args.policyHash as Hex,
        });
      }
      rows.sort((a, b) => Number(a.sequence - b.sequence));
      setActivity(rows);
    } catch {
      /* ignore */
    }
  }, [contracts]);

  useEffect(() => {
    void refreshChain();
    void refreshActivity();
  }, [refreshChain, refreshActivity]);

  const maxDayWei = useMemo(() => {
    try {
      return bound && Number(bound.maxValuePerDay) > 0 ? parseEther(bound.maxValuePerDay) : 0n;
    } catch {
      return 0n;
    }
  }, [bound]);

  const remainingWei = maxDayWei > 0n ? (maxDayWei > spentToday ? maxDayWei - spentToday : 0n) : null;
  const threshold = Number(bound?.minVerificationScore ?? draft.minVerificationScore ?? 20);
  const badge = riskBadge(chainScore, Number.isFinite(threshold) ? threshold : 20, scoreSet);
  const focusedChain = bound
    ? (chainPolicies.find((p) => p.policyHash.toLowerCase() === bound.policyHash.toLowerCase()) ?? null)
    : null;
  const otherActive = chainPolicies.filter(
    (p) => p.isActive && (!bound || p.policyHash.toLowerCase() !== bound.policyHash.toLowerCase()),
  );
  const onChainActive = Boolean(focusedChain?.isActive ?? bound?.isActive);
  const currentChainPlane = chainPlane(Boolean(bound), onChainActive);
  const bindHint = !contracts
    ? "Load deployed contract addresses first."
    : currentChainPlane === "active"
      ? "This desk already focuses an active policyHash. Revoke it before binding another if you want a single live policy."
      : otherActive.length > 0
        ? `${otherActive.length} other active policyHash${otherActive.length === 1 ? "" : "es"} already on-chain. Binding adds another independent hash — it does not replace them.`
        : undefined;

  const previewWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (osPlane === "assigned" && currentChainPlane === "unbound") {
      warnings.push("Assigned off-chain. Not bound. The agent cannot spend until Owner binds a policy.");
    }
    if (osPlane === "assigned" && currentChainPlane === "revoked") {
      warnings.push("Agent OS is still assigned. This policyHash is revoked. Spend is dead.");
    }
    if (bound && focusedChain && !focusedChain.isActive) {
      warnings.push(
        "This policyHash is revoked. The agent cannot move funds under it. Other active hashes (if any) still can.",
      );
    } else if (bound && !bound.isActive) {
      warnings.push(
        "This policyHash is revoked. The agent cannot move funds under it. Other active hashes (if any) still can.",
      );
    }
    try {
      const value = parseEther(amount || "0");
      const cap = focusedChain?.maxValuePerTx ?? (bound ? parseEther(bound.maxValuePerTx || "0") : 0n);
      if (bound && value > cap) {
        warnings.push(
          `Amount ${amount} ETH is over the per-transaction cap of ${formatEth(cap)}. The wallet will reject it.`,
        );
      }
      if (bound && remainingWei !== null && value > remainingWei) {
        warnings.push(
          `Amount ${amount} ETH is more than the remaining daily allowance (${formatEth(remainingWei)}).`,
        );
      }
    } catch {
      if (amount.trim()) warnings.push("Enter a valid ETH amount.");
    }
    if (!scoreSet) {
      warnings.push(
        "No mock risk score is recorded for this agent id. executeAction will revert until Owner writes a score.",
      );
    } else if (chainScore > threshold) {
      warnings.push(
        `Mock risk score ${chainScore} exceeds the threshold of ${threshold}. The wallet will reject the next action.`,
      );
    }
    return warnings;
  }, [amount, bound, chainScore, currentChainPlane, focusedChain, osPlane, remainingWei, scoreSet, threshold]);

  function applyAddresses() {
    if (!isAddress(walletInput) || !isAddress(oracleInput) || !isAddress(tokenInput)) {
      announce({ tone: "bad", text: "Paste valid Anvil contract addresses for the wallet, oracle, and token." });
      return;
    }
    setContracts({
      wallet: getAddress(walletInput),
      oracle: getAddress(oracleInput),
      token: getAddress(tokenInput),
    });
    announce({ tone: "ok", text: "Loaded contract addresses. Register a policy as Owner next." });
  }

  async function registerPolicy() {
    if (!contracts) {
      announce({ tone: "bad", text: "Load deployed contract addresses first." });
      return;
    }
    setBusy("register");
    setFlash(null);
    try {
      const actions = parseActionList(draft.allowedActions);
      const allowed = parseAddressList(draft.allowedContracts).map(getAddress);
      const blocked = parseAddressList(draft.blockedContracts).map(getAddress);
      if (actions.length === 0) throw new Error("Add at least one allowed action, for example transfer.");
      if (allowed.length === 0) throw new Error("Add at least one allowed target (the recipient).");
      if (!isAddress(draft.agent)) throw new Error("Agent address is not valid.");
      const scoreN = Number(draft.minVerificationScore);
      if (!Number.isInteger(scoreN) || scoreN < 0 || scoreN > 255) {
        throw new Error("Min verification score must be an integer from 0 to 255.");
      }
      const maxTx = parseEther(draft.maxValuePerTx);
      if (maxTx <= 0n) throw new Error("Amount per transaction is required and must be greater than 0.");
      const maxDay = draft.maxValuePerDay.trim() === "" || Number(draft.maxValuePerDay) === 0
        ? 0n
        : parseEther(draft.maxValuePerDay);
      const validAfter = BigInt(fromDatetimeLocal(draft.validAfter));
      const validUntil = BigInt(fromDatetimeLocal(draft.validUntil));
      if (validUntil <= validAfter) throw new Error("Expiry must be after the start of the validity period.");

      const wallet = ownerWallet();
      const client = publicClient();
      const args = [
        getAddress(draft.agent),
        BigInt(draft.agentId),
        actions,
        allowed,
        blocked,
        maxTx,
        maxDay,
        validAfter,
        validUntil,
        scoreN,
      ] as const;

      const { result: returnedHash, request } = await client.simulateContract({
        account: OWNER_ACCOUNT,
        address: contracts.wallet,
        abi: boundWalletAbi,
        functionName: "registerPolicy",
        args,
      });

      const hash = await wallet.writeContract(request);
      const receipt = await client.waitForTransactionReceipt({ hash });
      const parsed = parseEventLogs({
        abi: boundWalletAbi,
        logs: receipt.logs,
        eventName: "PolicyRegistered",
      });
      const eventHash = parsed[0]?.args.policyHash;
      if (!eventHash) throw new Error("Registered, but PolicyRegistered did not include policyHash.");
      if (eventHash.toLowerCase() !== returnedHash.toLowerCase()) {
        throw new Error(
          `policyHash mismatch: registerPolicy returned ${returnedHash} but PolicyRegistered emitted ${eventHash}.`,
        );
      }
      const onChain = await client.readContract({
        address: contracts.wallet,
        abi: boundWalletAbi,
        functionName: "getPolicy",
        args: [eventHash],
      });
      if (onChain[0].toLowerCase() === zeroAddress) {
        throw new Error("getPolicy does not recognize this policyHash.");
      }
      if (onChain[0].toLowerCase() !== getAddress(draft.agent).toLowerCase()) {
        throw new Error("getPolicy agent does not match the registerPolicy agent.");
      }
      if (onChain[2] !== maxTx) {
        throw new Error("getPolicy maxValuePerTx does not match the amount registered.");
      }
      setBound({ ...draft, policyHash: eventHash, isActive: onChain[4] });
      setNonce("1");
      const extraActive = chainPolicies.filter((p) => p.isActive).length;
      announce({
        tone: extraActive > 0 ? "mute" : "ok",
        text:
          extraActive > 0
            ? `Registered ${policyLabel(eventHash)}. This is an additional on-chain policyHash — it does not replace other active policies. Each hash has its own caps.`
            : `Policy registered. ${policyLabel(eventHash)} is the on-chain key (registerPolicy return = PolicyRegistered = getPolicy).`,
      });
      await refreshChain();
    } catch (err) {
      announce({ tone: "bad", text: explainRevert(err) });
    } finally {
      setBusy(null);
    }
  }

  async function revokePolicy() {
    if (!contracts || !bound) return;
    setBusy("revoke");
    setFlash(null);
    try {
      const hash = await ownerWallet().writeContract({
        address: contracts.wallet,
        abi: boundWalletAbi,
        functionName: "revokePolicy",
        args: [bound.policyHash, revokeReason],
      });
      await publicClient().waitForTransactionReceipt({ hash });
      setBound({ ...bound, isActive: false });
      announce({
        tone: "ok",
        text:
          osPlane === "assigned"
            ? `Revoked ${policyLabel(bound.policyHash)} on-chain. Agent OS is still marked assigned — it cannot stop executeAction. Spend under this hash is dead.`
            : `Revoked ${policyLabel(bound.policyHash)}. The agent cannot move funds under this hash. Other active policyHashes (if any) are unchanged.`,
      });
      await refreshChain();
    } catch (err) {
      announce({ tone: "bad", text: explainRevert(err) });
    } finally {
      setBusy(null);
    }
  }

  async function applyRisk() {
    if (!contracts) return;
    setBusy("risk");
    setFlash(null);
    try {
      const hash = await ownerWallet().writeContract({
        address: contracts.oracle,
        abi: mockRiskOracleAbi,
        functionName: "setScore",
        args: [BigInt(draft.agentId || "1"), sliderScore],
      });
      await publicClient().waitForTransactionReceipt({ hash });
      setChainScore(sliderScore);
      setScoreSet(true);
      const next = riskBadge(sliderScore, threshold, true);
      announce({
        tone: next.tone === "bad" ? "bad" : "ok",
        text:
          next.tone === "bad"
            ? `Risk score ${sliderScore} is now above the policy threshold of ${threshold}. The next agent action should revert.`
            : `Risk score ${sliderScore} is at or below the threshold of ${threshold}. Agent transfers can still pass this check.`,
      });
    } catch (err) {
      announce({ tone: "bad", text: explainRevert(err) });
    } finally {
      setBusy(null);
    }
  }

  async function simulateAgent() {
    if (!contracts || !bound) {
      announce({
        tone: "bad",
        text:
          osPlane === "assigned"
            ? "Assigned off-chain. Not bound. Register a policy before the agent can spend."
            : "Register a policy before simulating the agent.",
      });
      return;
    }
    setBusy("execute");
    setFlash(null);
    try {
      if (!isAddress(target)) throw new Error("Target address is not valid.");
      const value = parseEther(amount);
      const nonceBn = BigInt(nonce);
      const onChain = await publicClient().readContract({
        address: contracts.wallet,
        abi: boundWalletAbi,
        functionName: "getPolicy",
        args: [bound.policyHash],
      });
      const validUntil = onChain[3];
      const signature = await AGENT_ACCOUNT.signTypedData({
        domain: {
          ...eip712Domain,
          chainId: ANVIL_CHAIN_ID,
          verifyingContract: contracts.wallet,
        },
        types: agentActionTypes,
        primaryType: "AgentAction",
        message: {
          agent: getAddress(bound.agent),
          action,
          target: getAddress(target),
          value,
          data: "0x",
          nonce: nonceBn,
          validUntil,
          policyHash: bound.policyHash,
          entropyCommitment: ZERO_HASH,
        },
      });

      const hash = await ownerWallet().writeContract({
        address: contracts.wallet,
        abi: boundWalletAbi,
        functionName: "executeAction",
        args: [bound.policyHash, getAddress(target), value, "0x", nonceBn, ZERO_HASH, signature, action],
      });
      await publicClient().waitForTransactionReceipt({ hash });
      setNonce(String(nonceBn + 1n));
      announce({
        tone: "ok",
        text: `Agent action succeeded. ${formatEth(value)} sent to the recipient under ${policyLabel(bound.policyHash)}.`,
      });
      await refreshChain();
      await refreshActivity();
    } catch (err) {
      announce({ tone: "bad", text: explainRevert(err) });
    } finally {
      setBusy(null);
    }
  }

  let previewValidUntil = 0;
  try {
    previewValidUntil = bound ? fromDatetimeLocal(bound.validUntil) : 0;
  } catch {
    previewValidUntil = 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-16">
      <header className="mb-8 flex flex-col gap-3 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.22em] text-copper uppercase">ERC-8196 · Anvil 31337</p>
          <h1 className="font-serif text-4xl text-cream sm:text-5xl">Bound Wallet</h1>
          <p className="mt-2 max-w-xl text-sm text-mute">
            Two permission planes: Agent OS assigns, Bound Wallet binds. The agent never holds the
            owner key. Only the on-chain policy stops executeAction. Anvil demo — see the trust note.
          </p>
        </div>
        <div className="text-sm text-mute">
          {anvilOk === null && "Checking Anvil…"}
          {anvilOk === true && <span className="text-ok">Anvil live · chain 31337</span>}
          {anvilOk === false && (
            <span className="text-bad">Anvil not reachable. Start it, then keep this UI on /rpc.</span>
          )}
        </div>
      </header>

      <p className="mb-6 text-sm text-mute">
        Camera path: mark Agent OS assigned → Bind the grant → transfer 0.1 ETH → transfer 2 ETH
        (fail) → revoke on-chain while assignment still looks live. MVP: one focused policyHash.
      </p>
      <p className="mb-6 rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-mute">
        Track A trust: Agent OS assign/revoke is off-chain (camera toggle or MCP). It does not bind
        or unbind this wallet. MockRiskOracle is a mock IERC-8126 (Owner-only setScore; unset scores
        fail closed). Entropy commit–reveal is stubbed. Not ERC-8004 Final. Details in{" "}
        <span className="font-mono text-cream">TRUST.md</span>.
      </p>

      <DualPlaneBoard
        os={osPlane}
        onOs={setOsPlane}
        chain={currentChainPlane}
        policyHash={bound?.policyHash}
        draft={draft}
        owner={OWNER_ADDRESS}
        agent={getAddress(isAddress(draft.agent) ? draft.agent : AGENT_ADDRESS)}
        canBind={Boolean(contracts) && currentChainPlane !== "active"}
        busy={busy}
        onBind={() => void registerPolicy()}
        bindHint={bindHint}
      />

      {flash && (
        <div
          ref={flashRef}
          className={`sticky top-3 z-30 mb-6 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/40 ${
            flash.tone === "ok"
              ? "border-ok/40 bg-paper text-ok"
              : flash.tone === "bad"
                ? "border-bad/40 bg-paper text-bad"
                : "border-rule bg-paper text-mute"
          }`}
        >
          {flash.text}
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <IdentityCard
          role="Owner"
          blurb="Registers and revokes policy. Relays agent actions. Never shared with the agent."
          address={OWNER_ADDRESS}
        />
        <IdentityCard
          role="Agent"
          blurb="Signs AgentAction only. This key cannot register, revoke, or change the bound."
          address={AGENT_ADDRESS}
        />
      </section>

      <section className="card mb-6">
        <h2 className="font-serif text-2xl">Contract addresses</h2>
        <p className="mt-1 mb-4 text-sm text-mute">
          Deploy with <span className="font-mono text-cream">./script/deploy-anvil.sh</span> and restart
          the UI, or paste the three addresses here.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="lbl">BoundWallet</span>
            <input className="field font-mono text-xs" value={walletInput} onChange={(e) => setWalletInput(e.target.value)} />
          </label>
          <label>
            <span className="lbl">MockRiskOracle</span>
            <input className="field font-mono text-xs" value={oracleInput} onChange={(e) => setOracleInput(e.target.value)} />
          </label>
          <label>
            <span className="lbl">MockERC20</span>
            <input className="field font-mono text-xs" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={applyAddresses}>
            Load addresses
          </button>
          {contracts && (
            <span className="text-sm text-mute">
              Vault holds {formatEth(vaultEth)} (asset: native ETH)
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <section className="card">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setEditorOpen((o) => !o)}
              aria-expanded={editorOpen}
            >
              <div>
                <h2 className="font-serif text-2xl">Policy editor</h2>
                <p className="mt-1 text-sm text-mute">
                  Advanced. Maps 1:1 to ERC-8196 fields. Bind uses these values. After registration
                  the policy is immutable except for revoke.
                </p>
              </div>
              <span className="mt-1 text-xs tracking-wide text-mute uppercase">
                {editorOpen ? "Hide" : "Show"}
              </span>
            </button>
            {editorOpen && (
            <>
            <p className="mt-3 mb-4 text-sm text-mute">
              Caps meter native value and ERC-20 transfer/transferFrom amounts in raw 18-decimal
              units. The on-chain <span className="text-cream">policyHash</span> is the
              registerPolicy return value.
            </p>
            {otherActive.length > 0 && (
              <p className="mb-4 rounded-lg border border-warn/40 bg-ink px-3 py-2 text-sm text-warn">
                {otherActive.length} other active policyHash
                {otherActive.length === 1 ? "" : "es"} already on-chain. Registering again creates
                another independent policy — it does not replace the previous hash. MVP: revoke
                first if you want a single live policy.
              </p>
            )}
            {bound?.isActive && otherActive.length === 0 && (
              <p className="mb-4 rounded-lg border border-rule bg-ink px-3 py-2 text-sm text-mute">
                MVP: this desk focuses one active policy at a time. Registering again adds a second
                on-chain policyHash with its own caps.
              </p>
            )}
            <div className="grid gap-3">
              <label>
                <span className="lbl">Allowed actions</span>
                <input
                  className="field"
                  value={draft.allowedActions}
                  onChange={(e) => setDraft({ ...draft, allowedActions: e.target.value })}
                />
              </label>
              <label>
                <span className="lbl">Allowed contracts / recipients</span>
                <textarea
                  className="field min-h-16 font-mono text-xs"
                  value={draft.allowedContracts}
                  onChange={(e) => setDraft({ ...draft, allowedContracts: e.target.value })}
                />
              </label>
              <label>
                <span className="lbl">Blocked contracts</span>
                <textarea
                  className="field min-h-16 font-mono text-xs"
                  placeholder="Optional"
                  value={draft.blockedContracts}
                  onChange={(e) => setDraft({ ...draft, blockedContracts: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="lbl">Amount per transaction (ETH)</span>
                  <input
                    className="field"
                    value={draft.maxValuePerTx}
                    onChange={(e) => setDraft({ ...draft, maxValuePerTx: e.target.value })}
                  />
                </label>
                <label>
                  <span className="lbl">Amount per day (optional)</span>
                  <input
                    className="field"
                    value={draft.maxValuePerDay}
                    onChange={(e) => setDraft({ ...draft, maxValuePerDay: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="lbl">Valid after</span>
                  <input
                    type="datetime-local"
                    className="field"
                    value={draft.validAfter}
                    onChange={(e) => setDraft({ ...draft, validAfter: e.target.value })}
                  />
                </label>
                <label>
                  <span className="lbl">Expiry</span>
                  <input
                    type="datetime-local"
                    className="field"
                    value={draft.validUntil}
                    onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="lbl">Agent address</span>
                  <input
                    className="field font-mono text-xs"
                    value={draft.agent}
                    onChange={(e) => setDraft({ ...draft, agent: e.target.value })}
                  />
                </label>
                <label>
                  <span className="lbl">Agent id (mock)</span>
                  <input
                    className="field"
                    value={draft.agentId}
                    onChange={(e) => setDraft({ ...draft, agentId: e.target.value })}
                  />
                </label>
              </div>
              <label>
                <span className="lbl">Min verification score (reject if risk exceeds)</span>
                <input
                  className="field"
                  value={draft.minVerificationScore}
                  onChange={(e) => setDraft({ ...draft, minVerificationScore: e.target.value })}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-copper mt-4"
              disabled={busy !== null}
              onClick={() => void registerPolicy()}
            >
              {busy === "register" ? "Registering…" : "Register policy as Owner"}
            </button>
            </>
            )}
          </section>

          <section className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Risk</h2>
                <p className="mt-1 text-sm text-mute">
                  Mock ERC-8126 score. Lower is safer. Unset scores fail closed — the wallet will
                  not treat a missing score as 0. After a score is written, the wallet rejects the
                  next agent action only if it is{" "}
                  <span className="text-cream">greater than {threshold}</span>. To demo a revert,
                  set the slider to 25 or higher, then write the oracle.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  badge.tone === "ok"
                    ? "bg-ok/15 text-ok"
                    : badge.tone === "bad"
                      ? "bg-bad/15 text-bad"
                      : "bg-warn/15 text-warn"
                }`}
              >
                {badge.label}
              </span>
            </div>
            <p className="mt-3 text-sm">
              {scoreSet
                ? `On-chain score ${chainScore} · threshold ${threshold} · ${
                    sliderScore > threshold
                      ? `slider ${sliderScore} would reject`
                      : `slider ${sliderScore} would still pass`
                  }`
                : `No score recorded for this agent id · executeAction will revert · slider ${sliderScore}`}
            </p>
            <input
              type="range"
              min={0}
              max={40}
              value={sliderScore}
              onChange={(e) => setSliderScore(Number(e.target.value))}
              className="mt-3 w-full accent-copper"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-mute">
              <span>0 lowest</span>
              <span>Slider {sliderScore}</span>
              <span>40 high</span>
            </div>
            <button type="button" className="btn btn-ghost mt-3" disabled={busy !== null} onClick={() => void applyRisk()}>
              {busy === "risk" ? "Writing score…" : "Write score to mock oracle"}
            </button>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-7">
          <PolicySeal
            bound={bound}
            chain={focusedChain}
            allPolicies={chainPolicies}
            remainingWei={remainingWei}
            spentToday={spentToday}
            tokenAddress={contracts?.token}
          />

          {bound && (
            <section className="card">
              <h2 className="font-serif text-2xl">Revoke</h2>
              <p className="mt-1 mb-3 text-sm text-mute">
                Only the owner can revoke. The agent cannot. This does{" "}
                <span className="text-cream">not</span> unassign Agent OS — assignment can still look
                live. Revoke applies to{" "}
                <span className="font-mono text-cream">{policyLabel(bound.policyHash)}</span> only.
              </p>
              <label>
                <span className="lbl">Reason</span>
                <input className="field" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-bad mt-3"
                disabled={busy !== null || !bound.isActive}
                onClick={() => void revokePolicy()}
              >
                {busy === "revoke" ? "Revoking…" : bound.isActive ? "Revoke on-chain (Agent OS unchanged)" : "Already revoked"}
              </button>
            </section>
          )}

          <section className="card">
            <h2 className="font-serif text-2xl">Simulate agent</h2>
            <p className="mt-1 mb-4 text-sm text-mute">
              Builds and signs EIP-712 AgentAction with the Agent key, then the Owner relays{" "}
              <span className="text-cream">executeAction</span> including the trailing action string.
              This simulate path sends <span className="font-mono text-cream">data = 0x</span> (native
              ETH). ERC-20 transfer/transferFrom in calldata is metered on-chain, not from this form.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="lbl">Action</span>
                <input className="field" value={action} onChange={(e) => setAction(e.target.value)} />
              </label>
              <label>
                <span className="lbl">Amount (ETH)</span>
                <input className="field" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="sm:col-span-2">
                <span className="lbl">Target (who receives the asset)</span>
                <input className="field font-mono text-xs" value={target} onChange={(e) => setTarget(e.target.value)} />
              </label>
              <label>
                <span className="lbl">Nonce</span>
                <input className="field" value={nonce} onChange={(e) => setNonce(e.target.value)} />
              </label>
              <label>
                <span className="lbl">Asset</span>
                <input className="field" value="Native ETH" readOnly />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-rule bg-ink px-4 py-4">
              <p className="lbl">Agent action preview</p>
              <dl className="mt-2 space-y-2 text-sm">
                <Row k="Action" v={actionInEnglish(action)} />
                <Row
                  k="Who receives it"
                  v={isAddress(target) ? `Recipient ${target}` : "Enter a recipient address"}
                />
                <Row k="Amount" v={`${amount || "0"} ETH`} />
                <Row
                  k="Policy"
                  v={bound ? policyLabel(bound.policyHash) : "No policy registered yet"}
                />
                <Row
                  k="Expiry of this authorization"
                  v={bound ? formatWhen(previewValidUntil) : "—"}
                />
                <Row k="Nonce" v={`${nonce} — this exact action can run only once`} />
              </dl>
              {previewWarnings.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-bad">
                  {previewWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-3 text-xs text-mute underline"
                onClick={() => setAdvancedOpen((o) => !o)}
              >
                {advancedOpen ? "Hide raw fields" : "Show raw fields (advanced)"}
              </button>
              {advancedOpen && bound && (
                <pre className="mt-2 overflow-x-auto text-[11px] leading-5 text-mute">
{`policyHash ${bound.policyHash}
target     ${target}
valueWei   ${safeParseEther(amount)}
action     ${action}
nonce      ${nonce}
entropy    ${ZERO_HASH}
validUntil ${previewValidUntil}`}
                </pre>
              )}
            </div>

            <button
              type="button"
              className="btn btn-copper mt-4"
              disabled={busy !== null || !bound?.isActive}
              onClick={() => void simulateAgent()}
            >
              {busy === "execute" ? "Submitting…" : "Sign as Agent and execute"}
            </button>
          </section>
        </div>
      </div>

      <section className="card mt-6">
        <h2 className="font-serif text-2xl">Activity log</h2>
        <p className="mt-1 mb-4 text-sm text-mute">
          Hash-chained audit. Each row’s previous hash should match the entry id above it.
        </p>
        {activity.length === 0 ? (
          <p className="text-sm text-mute">No agent actions yet. A successful transfer appears here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs tracking-wide text-mute uppercase">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Seq</th>
                  <th className="pb-2 pr-3 font-medium">Action</th>
                  <th className="pb-2 pr-3 font-medium">Target</th>
                  <th className="pb-2 pr-3 font-medium">Amount</th>
                  <th className="pb-2 pr-3 font-medium">policyHash</th>
                  <th className="pb-2 pr-3 font-medium">Previous</th>
                  <th className="pb-2 font-medium">Entry</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, i) => {
                  const prev = i === 0 ? null : activity[i - 1];
                  const linked = prev && prev.entryId.toLowerCase() === row.previousHash.toLowerCase();
                  const genesis = row.previousHash === ZERO_HASH;
                  return (
                    <tr key={row.entryId} className="border-t border-rule/80">
                      <td className="py-3 pr-3 font-mono">{row.sequence.toString()}</td>
                      <td className="py-3 pr-3">{actionInEnglish(row.action)}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{shortHash(row.target, 4, 4)}</td>
                      <td className="py-3 pr-3">{formatEth(row.value)}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{shortHash(row.policyHash)}</td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        {genesis ? "genesis" : shortHash(row.previousHash)}
                        {linked && <span className="ml-2 text-ok">links seq {prev.sequence.toString()}</span>}
                        {prev && !linked && !genesis && <span className="ml-2 text-bad">broken link</span>}
                      </td>
                      <td className="py-3 font-mono text-xs">{shortHash(row.entryId)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function IdentityCard({ role, blurb, address }: { role: string; blurb: string; address: Address }) {
  return (
    <div className="card">
      <p className="text-xs tracking-[0.18em] text-copper uppercase">{role}</p>
      <p className="mt-2 font-mono text-sm break-all text-cream">{address}</p>
      <p className="mt-2 text-sm text-mute">{blurb}</p>
      <CopyButton value={address} label="Copy address" />
    </div>
  );
}

function PolicySeal({
  bound,
  chain,
  allPolicies,
  remainingWei,
  spentToday,
  tokenAddress,
}: {
  bound: BoundPolicy | null;
  chain: ChainPolicy | null;
  allPolicies: ChainPolicy[];
  remainingWei: bigint | null;
  spentToday: bigint;
  tokenAddress?: Address;
}) {
  const empty = (
    <section className="card">
      <h2 className="font-serif text-2xl">No policy bound yet</h2>
      <p className="mt-2 text-sm text-mute">
        Bind the grant above as Owner. The seal shows the on-chain{" "}
        <span className="text-cream">policyHash</span> from registerPolicy / getPolicy — the same
        bytes32, not a decorative nickname.
      </p>
      {allPolicies.length > 0 && <PolicyHashList policies={allPolicies} focused={null} />}
    </section>
  );

  if (!bound) return empty;

  const hashMismatch = Boolean(bound && !chain);
  const status = chain ? (chain.isActive ? "Active" : "Revoked") : "getPolicy empty";
  const capTx = chain ? formatEth(chain.maxValuePerTx) : `${bound.maxValuePerTx} ETH (local only)`;
  const expiry = chain ? formatWhen(chain.validUntil) : formatWhen(fromDatetimeLocal(bound.validUntil));
  const allowed = parseAddressList(bound.allowedContracts);
  const tokenListed =
    Boolean(tokenAddress) &&
    allowed.some((a) => tokenAddress && a.toLowerCase() === tokenAddress.toLowerCase());
  const asset = tokenListed
    ? "Native ETH (value) + ERC-20 transfer/transferFrom amounts in calldata. Raw token units, no decimal conversion (18-decimal assumption; MockERC20 is 18)."
    : "Native ETH via executeAction value. Token is not in this policy’s allowlist. If you allowlist an ERC-20, transfer/transferFrom amounts are metered in raw 18-decimal units.";

  return (
    <section className="card">
      <p className="text-xs tracking-[0.18em] text-copper uppercase">{status}</p>
      <h2 className="font-serif text-3xl leading-tight text-cream">{policyLabel(bound.policyHash)}</h2>
      <p className="mt-2 text-sm text-mute">
        Short form of the same on-chain policyHash (registerPolicy return = PolicyRegistered =
        getPolicy key). Not a second hash.
      </p>
      {hashMismatch && (
        <p className="mt-3 rounded-lg border border-bad/40 bg-ink px-3 py-2 text-sm text-bad">
          getPolicy does not return this hash. The seal will not invent a substitute. Re-register or
          load the address of the wallet that emitted it.
        </p>
      )}
      <div className="mt-4 rounded-lg border border-rule bg-ink px-3 py-3">
        <span className="lbl">On-chain policyHash</span>
        <p className="font-mono text-xs leading-6 break-all">{bound.policyHash}</p>
        <CopyButton value={bound.policyHash} label="Copy full policyHash" />
      </div>
      <p className="mt-4 text-xs tracking-[0.12em] text-mute uppercase">
        MVP — one focused policy at a time
      </p>
      <p className="mt-1 text-sm text-mute">
        This desk edits and simulates against the hash above. The contract may hold several active
        policies; each has its own policyHash and caps. Revoke does not cover the others.
      </p>
      <PolicyHashList policies={allPolicies} focused={bound.policyHash} />
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Row k="getPolicy agent" v={chain ? chain.agent : "—"} />
        <Row k="getPolicy owner" v={chain ? chain.owner : "—"} />
        <Row k="Amount per transaction" v={capTx} />
        <Row
          k="Period"
          v={Number(bound.maxValuePerDay) > 0 ? `${bound.maxValuePerDay} ETH per day (register form; not in getPolicy)` : "No daily cap"}
        />
        <Row k="Expiry (getPolicy)" v={expiry} />
        {remainingWei !== null && (
          <Row k="Remaining today" v={`${formatEth(remainingWei)} (${formatEth(spentToday)} spent)`} />
        )}
        <Row k="Status (getPolicy)" v={status} />
        <Row k="Allowlist (registered)" v={allowed.length ? allowed.join(", ") : "—"} />
        <Row k="Metered assets" v={asset} />
      </dl>
    </section>
  );
}

function PolicyHashList({
  policies,
  focused,
}: {
  policies: ChainPolicy[];
  focused: Hex | null;
}) {
  if (policies.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-rule bg-ink px-3 py-3">
      <span className="lbl">On-chain policyHashes</span>
      <ul className="mt-2 space-y-2 text-xs">
        {policies.map((p) => {
          const isFocus = focused && p.policyHash.toLowerCase() === focused.toLowerCase();
          return (
            <li key={p.policyHash} className="font-mono break-all">
              <span className={p.isActive ? "text-ok" : "text-mute"}>
                {p.isActive ? "active" : "revoked"}
              </span>
              {" · "}
              <span className="text-cream">{p.policyHash}</span>
              {isFocus && <span className="ml-2 text-copper">focused</span>}
              <span className="mt-0.5 block text-mute">
                cap {formatEth(p.maxValuePerTx)} · expiry {formatWhen(p.validUntil)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-mute">{k}</dt>
      <dd className="text-cream">{v}</dd>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost mt-2 px-3 py-1 text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => undefined,
        );
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function safeParseEther(value: string): string {
  try {
    return parseEther(value || "0").toString();
  } catch {
    return "invalid";
  }
}
