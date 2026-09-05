import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { discoverProviders, listenForProviders } from "./providers";
import { EXPLORER_URL, getCase, getCount, sendWrite, STUDIONET_CHAIN, STUDIONET_CHAIN_ID, waitForSuccess } from "./rpc";
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
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [connectingUuid, setConnectingUuid] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
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
    getCount().then((value) => active && setCount(value)).catch(() => undefined);
    return () => { active = false; };
  }, []);

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
    setError(""); setHash(null); setStatus("Submitting once…");
    try {
      const tx = await sendWrite(selected.provider, account, "create_case", [
        form.caseId, "npm", form.packageName, form.version,
        canonicalRegistryUrl(form.packageName, form.version),
        form.repositoryOwner, form.repositoryName,
        `https://github.com/${form.repositoryOwner.toLowerCase()}/${form.repositoryName.toLowerCase()}/releases/tag/${form.version}`,
        form.expectedCommit.toLowerCase(), form.sourceSubdirectory,
      ]);
      setHash(tx); await waitForSuccess(tx, setStatus);
      const refreshed = await getCase(form.caseId, { finalized: true }); setResult(refreshed); setCaseId(form.caseId); setCount((value) => value === null ? value : value + 1); setStatus("Created and verified");
    } catch (cause) { setStatus("Needs attention"); setError(userFacingError(cause, "That action could not be completed. Check your wallet and try again.")); }
    finally { writeInFlightRef.current = false; setWriteInFlight(false); }
  }

  async function loadCase(event: FormEvent) {
    event.preventDefault(); setError("");
    try { setResult(await getCase(caseId)); } catch (cause) { setError(userFacingError(cause, "We could not load that case. Check the case ID and try again.")); }
  }

  async function runWrite(method: "freeze_case" | "assess_case" | "retry_unresolved") {
    if (!selected || !account || !caseId) { setError("Connect a wallet and load a case first."); return; }
    if (writeInFlightRef.current) return;
    writeInFlightRef.current = true;
    setWriteInFlight(true);
    setError(""); setStatus("Submitting once…");
    try { const tx = await sendWrite(selected.provider, account, method, [caseId]); setHash(tx); await waitForSuccess(tx, setStatus); setResult(await getCase(caseId, { finalized: true })); setStatus({ freeze_case: "Provenance locked", assess_case: "Assessment complete", retry_unresolved: "Retry complete" }[method]); } catch (cause) { setError(userFacingError(cause, "That action could not be completed. Check your wallet and try again.")); }
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
        <strong className="stat-value">{count !== null ? count : 0}</strong>
        <span className="stat-meta">Verified on Studionet</span>
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
          <span className="status-dot">{status}</span>
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
        <a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer" className="receipt-link">
          <span className="receipt-hash">{hash}</span>
          <span className="receipt-arrow" aria-hidden="true">↗</span>
        </a>
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
