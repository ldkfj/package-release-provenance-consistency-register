import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { discoverProviders, listenForProviders } from "./providers";
import { CONTRACT_ADDRESS, EXPLORER_URL, getCase, getCount, sendWrite, STUDIONET_CHAIN, STUDIONET_CHAIN_ID, waitForSuccess } from "./rpc";
import type { ContractCase, ProviderInfo } from "./types";
import "./styles.css";

const emptyForm = {
  caseId: "",
  packageName: "",
  version: "",
  repositoryOwner: "",
  repositoryName: "",
  expectedCommit: "",
  sourceSubdirectory: "",
};

export function canonicalRegistryUrl(packageName: string, version: string): string {
  const encodedPackage = packageName.startsWith("@") ? packageName.replace("/", "%2f") : packageName;
  return `https://registry.npmjs.org/${encodedPackage}/${version}`;
}

function formatAccount(address: string | null): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function publicTransactionStatus(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "FINALIZED") return "Finalized. Verifying result…";
  if (["ACCEPTED", "PROPOSING", "COMMITTING", "REVEALING", "READY_TO_FINALIZE"].includes(normalized)) {
    return "Transaction submitted. Waiting for finality…";
  }
  return status;
}

export type WritePhase =
  | "IDLE"
  | "WAITING_FOR_WALLET"
  | "SUBMITTED"
  | "WAITING_FOR_FINALITY"
  | "VERIFYING_EXECUTION"
  | "VERIFYING_READBACK"
  | "SUCCESS"
  | "REJECTED"
  | "FAILED"
  | "RECONCILIATION_REQUIRED";

export const INITIAL_WRITE_PROGRESS: { phase: WritePhase } = { phase: "IDLE" };
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function transactionPhaseFromStatus(status: string): WritePhase {
  const normalized = status.toUpperCase();
  if (normalized === "FINALIZED") return "VERIFYING_EXECUTION";
  if (["ACCEPTED", "PROPOSING", "COMMITTING", "REVEALING", "READY_TO_FINALIZE"].includes(normalized)) return "WAITING_FOR_FINALITY";
  if (["SUBMITTED", "PENDING"].includes(normalized)) return "SUBMITTED";
  return "RECONCILIATION_REQUIRED";
}

function isUserRejection(cause: unknown): boolean {
  const value = cause as { code?: unknown; cause?: { code?: unknown } } | null;
  return value?.code === 4001 || value?.cause?.code === 4001 || /reject|denied|cancel/i.test(cause instanceof Error ? cause.message : "");
}

function failurePhase(cause: unknown, hashReceived: boolean): WritePhase {
  if (isUserRejection(cause)) return "REJECTED";
  const raw = cause instanceof Error ? cause.message : "";
  if (hashReceived && /timeout|could not be confirmed|readback|busy|rate|unavailable|reconciliation/i.test(raw)) return "RECONCILIATION_REQUIRED";
  return "FAILED";
}

function failureStatus(phase: WritePhase): string {
  if (phase === "REJECTED") return "Wallet request canceled";
  if (phase === "RECONCILIATION_REQUIRED") return "Verification needs attention";
  return "Transaction failed";
}

export function userFacingError(cause: unknown, fallback: string): string {
  const raw = cause instanceof Error ? cause.message : "";
  const code = cause && typeof cause === "object" && "code" in cause ? Number((cause as { code?: unknown }).code) : undefined;
  if (/ERR_DUPLICATE_PROVENANCE|duplicate provenance|already registered/i.test(raw)) return "This package release is already registered. Use a different package version or load the existing case by ID.";
  if (code === 4001 || /reject|denied|cancel/i.test(raw)) return "The wallet request was canceled. Choose a wallet to try again.";
  if (/insufficient|balance/i.test(raw)) return "This wallet does not have enough balance for that action.";
  if (/network|chain/i.test(raw)) return "Your wallet is on the wrong network. Reconnect and try again.";
  if (/429|rate|busy|timeout|unavailable/i.test(raw)) return "The service is busy right now. Wait a moment and try again once.";
  if (/ERR_|contract|RPC|transaction|readback|provider|request|hash/i.test(raw)) return fallback;
  return fallback;
}

export default function App() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selected, setSelected] = useState<ProviderInfo | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [caseId, setCaseId] = useState("");
  const [result, setResult] = useState<ContractCase | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [countUnavailable, setCountUnavailable] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [transactionPhase, setTransactionPhase] = useState<WritePhase>(INITIAL_WRITE_PROGRESS.phase);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [connectingUuid, setConnectingUuid] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [copied, setCopied] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [writeInFlight, setWriteInFlight] = useState(false);
  const writeInFlightRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const wasChooserOpen = useRef(false);

  useEffect(() => listenForProviders(setProviders), []);
  useEffect(() => {
    if (!selected?.provider || !account || !selected.provider.on) return;
    const activeAccount = account;
    const invalidate = (message: string) => {
      setSelected(null);
      setAccount(null);
      setResult(null);
      setHash(null);
      setTransactionPhase("IDLE");
      setStatus(message);
    };
    const accountsChanged = (...args: unknown[]) => {
      const next = args[0];
      const nextAccount = Array.isArray(next) && typeof next[0] === "string" ? next[0] : "";
      if (!nextAccount || nextAccount.toLowerCase() !== activeAccount.toLowerCase()) {
        invalidate("Your wallet account changed. Connect again to continue.");
      }
    };
    const chainChanged = () => invalidate("Your wallet network changed. Connect again to continue.");
    const disconnected = () => invalidate("Your wallet was disconnected. Connect again to continue.");
    selected.provider.on("accountsChanged", accountsChanged);
    selected.provider.on("chainChanged", chainChanged);
    selected.provider.on("disconnect", disconnected);
    return () => {
      selected.provider.removeListener?.("accountsChanged", accountsChanged);
      selected.provider.removeListener?.("chainChanged", chainChanged);
      selected.provider.removeListener?.("disconnect", disconnected);
    };
  }, [selected, account]);
  useEffect(() => {
    const main = mainRef.current;
    if (chooserOpen) {
      wasChooserOpen.current = true;
      main?.setAttribute("aria-hidden", "true");
      if (main) (main as HTMLElement & { inert: boolean }).inert = true;
      return () => {
        if (main) (main as HTMLElement & { inert: boolean }).inert = false;
        main?.removeAttribute("aria-hidden");
      };
    }
    if (wasChooserOpen.current) {
      wasChooserOpen.current = false;
      requestAnimationFrame(() => restoreFocusRef.current?.focus());
    }
    return undefined;
  }, [chooserOpen]);
  useEffect(() => {
    if (!chooserOpen) return;
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [chooserOpen, providers.length, connectionError]);
  useEffect(() => {
    let active = true;
    getCount({ finalized: true })
      .then((value) => { if (active) { setCount(value); setCountUnavailable(false); } })
      .catch(() => { if (active) { setCount(null); setCountUnavailable(true); } });
    return () => { active = false; };
  }, []);

  async function refreshFinalizedCount(): Promise<void> {
    try {
      const value = await getCount({ finalized: true });
      setCount(value);
      setCountUnavailable(false);
    } catch {
      setCount(null);
      setCountUnavailable(true);
    }
  }

  const connectedLabel = useMemo(() => account ? "Wallet connected" : "Connect wallet", [account]);

  function openPicker() {
    restoreFocusRef.current = connectButtonRef.current;
    setConnectionError("");
    setProviders(discoverProviders());
    setChooserOpen(true);
  }

  function closePicker() {
    setChooserOpen(false);
    setConnectionError("");
  }

  async function copyHash() {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("The transaction hash could not be copied. Select it manually from the receipt.");
    }
  }

  function handlePickerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function connect(provider: ProviderInfo) {
    setError("");
    setConnectionError("");
    setConnectingUuid(provider.uuid);
    try {
      const accounts = await provider.provider.request({ method: "eth_requestAccounts" });
      const next = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] as `0x${string}` : null;
      if (!next) throw new Error("The selected wallet returned no account.");
      try {
        await provider.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_ID }] });
      } catch (cause) {
        const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code?: unknown }).code : undefined;
        if (code !== 4902) throw cause;
        await provider.provider.request({ method: "wallet_addEthereumChain", params: [STUDIONET_CHAIN] });
        await provider.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_ID }] });
      }
      const chainId = await provider.provider.request({ method: "eth_chainId" });
      if (String(chainId).toLowerCase() !== STUDIONET_CHAIN_ID.toLowerCase()) throw new Error("Wallet is not connected to Studionet.");
      setSelected(provider); setAccount(next); setChooserOpen(false); setStatus("Wallet connected");
    } catch (cause) { setConnectionError(userFacingError(cause, "This wallet could not connect. Choose another wallet or try again.")); }
    finally { setConnectingUuid(null); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !account) { setError("Choose a wallet before submitting."); return; }
    if (writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setError(""); setHash(null); setCopied(false); setTransactionPhase("WAITING_FOR_WALLET"); setStatus("Waiting for wallet confirmation…");
    let submittedHash: `0x${string}` | null = null;
    try {
      const tx = await sendWrite(selected.provider, account, "create_case", [
        form.caseId, "npm", form.packageName, form.version,
        canonicalRegistryUrl(form.packageName, form.version),
        form.repositoryOwner, form.repositoryName,
        `https://github.com/${form.repositoryOwner.toLowerCase()}/${form.repositoryName.toLowerCase()}/releases/tag/${form.version}`,
        form.expectedCommit.toLowerCase(), form.sourceSubdirectory,
      ]);
      submittedHash = tx;
      setHash(tx); setTransactionPhase("SUBMITTED"); setStatus("Transaction submitted. Waiting for finality…");
      setTransactionPhase("WAITING_FOR_FINALITY");
      await waitForSuccess(tx, (next) => { setTransactionPhase(transactionPhaseFromStatus(next)); setStatus(publicTransactionStatus(next)); });
      setTransactionPhase("VERIFYING_READBACK");
      const refreshed = await getCase(form.caseId, { finalized: true });
      setResult(refreshed); setCaseId(form.caseId); await refreshFinalizedCount(); setWriteInFlight(false); setTransactionPhase("SUCCESS"); setStatus("Created and verified");
    } catch (cause) {
      const phase = failurePhase(cause, Boolean(submittedHash));
      setTransactionPhase(phase); setStatus(failureStatus(phase)); setError(userFacingError(cause, "That action could not be completed. Check your wallet and try again."));
    }
    finally { writeInFlightRef.current = false; setWriteInFlight(false); }
  }

  async function loadCase(event: FormEvent) {
    event.preventDefault(); setError("");
    try { setResult(await getCase(caseId)); } catch (cause) { setError(userFacingError(cause, "We could not load that case. Check the case ID and try again.")); }
  }

  async function reconcileTransaction() {
    const activeHash = hash;
    const activeCaseId = caseId || form.caseId;
    if (!activeHash || !activeCaseId || writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setError(""); setTransactionPhase("WAITING_FOR_FINALITY"); setStatus("Checking transaction status…");
    try {
      await waitForSuccess(activeHash, (next) => { setTransactionPhase(transactionPhaseFromStatus(next)); setStatus(publicTransactionStatus(next)); });
      setTransactionPhase("VERIFYING_READBACK");
      setResult(await getCase(activeCaseId, { finalized: true }));
      await refreshFinalizedCount();
      setWriteInFlight(false); setTransactionPhase("SUCCESS"); setStatus("Verification complete");
    } catch (cause) {
      const phase = failurePhase(cause, true);
      setTransactionPhase(phase); setStatus(failureStatus(phase)); setError(userFacingError(cause, "The transaction could not be verified yet. Keep the hash and try again."));
    }
    finally { writeInFlightRef.current = false; setWriteInFlight(false); }
  }

  async function runWrite(method: "freeze_case" | "assess_case" | "retry_unresolved") {
    if (!selected || !account || !caseId) { setError("Connect a wallet and load a case first."); return; }
    if (writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setError(""); setCopied(false); setTransactionPhase("WAITING_FOR_WALLET"); setStatus("Waiting for wallet confirmation…");
    let submittedHash: `0x${string}` | null = null;
    try {
      const tx = await sendWrite(selected.provider, account, method, [caseId]);
      submittedHash = tx;
      setHash(tx); setTransactionPhase("SUBMITTED"); setStatus("Transaction submitted. Waiting for finality…");
      setTransactionPhase("WAITING_FOR_FINALITY");
      await waitForSuccess(tx, (next) => { setTransactionPhase(transactionPhaseFromStatus(next)); setStatus(publicTransactionStatus(next)); });
      setTransactionPhase("VERIFYING_READBACK");
      setResult(await getCase(caseId, { finalized: true }));
      setWriteInFlight(false); setTransactionPhase("SUCCESS"); setStatus({ freeze_case: "Provenance locked", assess_case: "Assessment complete", retry_unresolved: "Retry complete" }[method]);
    } catch (cause) {
      const phase = failurePhase(cause, Boolean(submittedHash));
      setTransactionPhase(phase); setStatus(failureStatus(phase)); setError(userFacingError(cause, "That action could not be completed. Check your wallet and try again."));
    }
    finally { writeInFlightRef.current = false; setWriteInFlight(false); }
  }

  return <>
  <main ref={mainRef}>
    <header className="topbar">
      <div className="brand-group">
        <img src="/logo.svg" alt="" width="38" height="38" className="brand-logo" />
        <div className="brand-copy">
          <div className="brand-eyebrow-row">
            <span className="eyebrow">GenLayer Studionet</span>
            <span className="network-pill"><span className="pulse-dot"></span>Studionet Live</span>
          </div>
          <h1>Provenance Register</h1>
        </div>
      </div>
      <div className="topbar-actions">
        {account && (
          <span className="account-chip" title={account}>
            <span className="account-dot"></span>
            <span className="account-address">{formatAccount(account)}</span>
          </span>
        )}
        <button ref={connectButtonRef} className="wallet" type="button" onClick={openPicker}>
          {connectedLabel}
        </button>
      </div>
    </header>

    <section className="hero">
      <div className="hero-content">
        <div className="hero-badge">
          <span className="badge-bullet" aria-hidden="true"></span>
          <p className="eyebrow">Release Integrity Verification</p>
        </div>
        <h2>Bind a package version to the source release it claims.</h2>
        <p className="lede">
          An immutable consensus register connecting package registry releases to verified GitHub tags, source commits, and subdirectories on GenLayer Studionet.
        </p>

        <div className="workflow-steps" aria-label="Provenance lifecycle stages">
          <div className="step-item">
            <span className="step-name">Register draft</span>
            <span className="step-desc">Declare registry target and commit</span>
          </div>
          <div className="step-separator" aria-hidden="true">→</div>
          <div className="step-item">
            <span className="step-name">Freeze inputs</span>
            <span className="step-desc">Lock inputs on-chain for verification</span>
          </div>
          <div className="step-separator" aria-hidden="true">→</div>
          <div className="step-item">
            <span className="step-name">Assess consistency</span>
            <span className="step-desc">Validators confirm consistency</span>
          </div>
        </div>
      </div>

      <div className="stat">
        <span className="stat-label">Registered Cases</span>
        <strong className="stat-value" aria-live="polite">{count !== null ? count : countUnavailable ? "Unavailable" : "Loading…"}</strong>
        <span className="stat-meta">{count !== null ? "Verified on Studionet" : countUnavailable ? "Total temporarily unavailable" : "Loading verified total"}</span>
      </div>
    </section>

    <section className="docs-section" aria-labelledby="how-it-works-title">
      <div className="docs-intro">
        <span className="eyebrow">Docs / How it works</span>
        <h2 id="how-it-works-title">A clear path from release claim to public record.</h2>
        <p>
          The register compares one npm package release with the GitHub source release it claims. GenLayer validators review the public evidence and the resulting state is kept on Studionet.
        </p>
      </div>
      <div className="docs-grid">
        <article className="docs-card">
          <span className="docs-card-label">Start here</span>
          <h3>Connect a wallet</h3>
          <p>Choose a wallet from the picker and confirm the connection. The page starts disconnected after every reload.</p>
        </article>
        <article className="docs-card">
          <span className="docs-card-label">Prepare the claim</span>
          <h3>Register a draft</h3>
          <p>Enter the package name and version, GitHub owner and repository, release commit, and optional source subdirectory.</p>
        </article>
        <article className="docs-card">
          <span className="docs-card-label">Verify the result</span>
          <h3>Freeze and assess</h3>
          <p>Create the draft, wait for finality, then use the case panel to freeze inputs and ask validators to assess consistency.</p>
        </article>
      </div>
      <div className="docs-footer">
        <p><strong>What to expect:</strong> A pending transaction shows its progress and keeps a copyable hash. After finality, the case panel shows the authoritative state and observed source result. Canceled or failed actions remain recoverable without silently submitting again.</p>
        <a className="docs-link" href={CONTRACT_ADDRESS ? `${EXPLORER_URL}/address/${CONTRACT_ADDRESS}` : EXPLORER_URL} target="_blank" rel="noreferrer">Verify the register on Studionet Explorer <span aria-hidden="true">↗</span></a>
      </div>
    </section>

    <section className="workspace">
      <div className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Package Registration</span>
            <h3>Register provenance target</h3>
            <p className="panel-subtitle">Create a verifiable draft case binding an npm release to its source repository and commit.</p>
          </div>
          <span className={`status-dot ${writeInFlight ? "status-pending" : ""}`} data-transaction-phase={transactionPhase} aria-live="polite" aria-atomic="true">
            {writeInFlight && <span className="status-spinner" aria-hidden="true"></span>}
            <span>{status}</span>
          </span>
        </div>
        <form onSubmit={submit} className="form-grid">
          <div className="form-section-title">Package Details</div>
          <label className="field-group">
            <span className="field-label">Case ID</span>
            <input name="caseId" autoComplete="off" required value={form.caseId} onChange={(event) => setForm({ ...form, caseId: event.target.value })} placeholder="e.g. pr-pkg-001" />
          </label>
          <label className="field-group">
            <span className="field-label">Package Name</span>
            <input name="packageName" autoComplete="off" required value={form.packageName} onChange={(event) => setForm({ ...form, packageName: event.target.value })} placeholder="e.g. lodash" />
          </label>
          <label className="field-group">
            <span className="field-label">Version</span>
            <input name="version" autoComplete="off" required value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="e.g. 4.17.21" />
          </label>

          <div className="form-section-title">Source Repository</div>
          <label className="field-group">
            <span className="field-label">Repository Owner</span>
            <input name="repositoryOwner" autoComplete="off" required value={form.repositoryOwner} onChange={(event) => setForm({ ...form, repositoryOwner: event.target.value })} placeholder="e.g. lodash" />
          </label>
          <label className="field-group">
            <span className="field-label">Repository Name</span>
            <input name="repositoryName" autoComplete="off" required value={form.repositoryName} onChange={(event) => setForm({ ...form, repositoryName: event.target.value })} placeholder="e.g. lodash" />
          </label>
          <label className="field-group">
            <span className="field-label">Source Subdirectory</span>
            <input name="sourceSubdirectory" autoComplete="off" value={form.sourceSubdirectory} onChange={(event) => setForm({ ...form, sourceSubdirectory: event.target.value })} placeholder="e.g. packages/core (optional)" />
          </label>

          <div className="form-section-title">Cryptographic Commit Target</div>
          <label className="field-group field-full">
            <span className="field-label">Expected Full Commit (40 hex characters)</span>
            <input name="expectedCommit" autoComplete="off" spellCheck={false} required value={form.expectedCommit} onChange={(event) => setForm({ ...form, expectedCommit: event.target.value })} placeholder="40 lowercase hex characters" className="mono-input" />
          </label>

          <button className="primary" type="submit" disabled={writeInFlight}>
            <span>Create case</span>
            <span className="primary-arrow" aria-hidden="true">↗</span>
          </button>
        </form>
      </div>

      <div className="panel detail">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Verification &amp; Audit</span>
            <h3>Case inspection</h3>
            <p className="panel-subtitle">Retrieve on-chain state, review consensus validation, and trigger lifecycle transitions.</p>
          </div>
          <span className={`state state-${result?.state?.toLowerCase() ?? "empty"}`}>{result?.state ?? "NO CASE LOADED"}</span>
        </div>

        <form onSubmit={loadCase} className="lookup" role="search" aria-label="Load case by ID">
          <input name="lookupCaseId" autoComplete="off" value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="Enter case ID to inspect…" aria-label="Case ID" />
          <button className="secondary" type="submit">Load Case</button>
        </form>

        {result ? (
          <div className="result">
            <div className={`outcome outcome-${result.state?.toLowerCase() ?? "pending"}`}>
              <div className="outcome-header">
                <span className="outcome-tag">Consensus Result</span>
                <span className="outcome-state-badge">{result.state}</span>
              </div>
              <div className="outcome-text">{result.outcome || "Awaiting consensus assessment"}</div>
            </div>

            <dl className="spec-list">
              <div className="spec-item">
                <dt>Package</dt>
                <dd className="spec-val"><span className="pkg-badge">{result.package_name}@{result.version}</span></dd>
              </div>
              <div className="spec-item">
                <dt>Repository</dt>
                <dd className="spec-val">{result.repository_owner}/{result.repository_name}</dd>
              </div>
              <div className="spec-item">
                <dt>Expected commit</dt>
                <dd className="mono spec-val">{result.expected_commit_id}</dd>
              </div>
              <div className="spec-item">
                <dt>Observed commit</dt>
                <dd className="mono spec-val">{result.observed_commit_id || "Pending assessment"}</dd>
              </div>
              {result.source_subdirectory && (
                <div className="spec-item">
                  <dt>Source subdirectory</dt>
                  <dd className="spec-val mono">{result.source_subdirectory}</dd>
                </div>
              )}
            </dl>

            <div className="action-guide">
              <span className="guide-label">Workflow Actions:</span>
              <div className="actions">
                <button type="button" onClick={() => runWrite("freeze_case")} disabled={writeInFlight || result.state !== "DRAFT"} title="Lock inputs to freeze case for consensus assessment">
                  Freeze
                </button>
                <button type="button" onClick={() => runWrite("assess_case")} disabled={writeInFlight || !(["FROZEN", "RETRYING"].includes(result.state))} title="Trigger GenLayer consensus evaluation">
                  Assess
                </button>
                <button type="button" onClick={() => runWrite("retry_unresolved")} disabled={writeInFlight || result.state !== "UNRESOLVED" || result.retry_count >= 2} title="Retry consensus evaluation (max 2 retries)">
                  Retry {result.retry_count}/2
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty">Load a case by ID to inspect its independently verified provenance outcome.</p>
          </div>
        )}
      </div>
    </section>

    {error && (
      <div className="alert" role="alert">
        <div className="alert-body">
          <span className="alert-badge">Notice</span>
          <span className="alert-text">{error}</span>
        </div>
      </div>
    )}

    {hash && (
      <div className="receipt">
        <div className="receipt-head">
          <span className="receipt-dot"></span>
          <span>Transaction</span>
        </div>
        <div className="receipt-actions">
          {transactionPhase === "RECONCILIATION_REQUIRED" && <button type="button" className="copy-hash" onClick={reconcileTransaction} disabled={writeInFlight}>Check again</button>}
          <button type="button" className="copy-hash" onClick={copyHash} aria-live="polite">{copied ? "Copied" : "Copy hash"}</button>
          <a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer" className="receipt-link">
            <span className="receipt-hash">{hash}</span>
            <span className="receipt-arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    )}
  </main>

  {chooserOpen && (
    <div className="backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closePicker()}>
      <section ref={dialogRef} className="chooser" role="dialog" aria-modal="true" aria-labelledby="chooser-title" tabIndex={-1} onKeyDown={handlePickerKeyDown}>
        <button className="close" type="button" aria-label="Close wallet chooser" onClick={closePicker}>×</button>
        <div className="chooser-header">
          <h3 id="chooser-title">Choose a wallet</h3>
          <p className="chooser-desc">Select a supported wallet to connect to Studionet.</p>
        </div>

        {connectionError && <p className="chooser-error" role="alert" aria-live="assertive">{connectionError}</p>}

        {providers.length ? (
          <div className="provider-list">
            {providers.map((provider) => (
              <button
                className="provider"
                type="button"
                data-wallet-option
                key={provider.uuid}
                disabled={Boolean(connectingUuid)}
                onClick={() => connect(provider)}
              >
                <img src={provider.icon} alt="" width="36" height="36" className="provider-icon" />
                <span className="provider-name">{provider.name}</span>
                <span className="provider-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">No supported wallet was detected. Install a supported wallet and try again.</p>
        )}

        <button className="picker-cancel" type="button" onClick={closePicker}>Cancel</button>
      </section>
    </div>
  )}
  </>;
}
