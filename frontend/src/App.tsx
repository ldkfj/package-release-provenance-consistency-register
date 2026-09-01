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

const providerDescriptions: Record<string, string> = {
  MetaMask: "Browser wallet",
  "OKX Wallet": "Web3 wallet",
  Rabby: "Secure browser wallet",
};

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

  function userFacingError(cause: unknown, fallback: string): string {
    const raw = cause instanceof Error ? cause.message : "";
    const code = cause && typeof cause === "object" && "code" in cause ? Number((cause as { code?: unknown }).code) : undefined;
    if (code === 4001 || /reject|denied|cancel/i.test(raw)) return "The wallet request was canceled. Choose a wallet to try again.";
    if (/insufficient|balance/i.test(raw)) return "This wallet does not have enough balance for that action.";
    if (/network|chain/i.test(raw)) return "Your wallet is on the wrong network. Reconnect and try again.";
    if (/429|rate|busy|timeout|unavailable/i.test(raw)) return "The service is busy right now. Wait a moment and try again once.";
    if (/ERR_|contract|RPC|transaction|readback|provider|request|hash/i.test(raw)) return fallback;
    return raw || fallback;
  }

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
    setError(""); setHash(null); setStatus("Submitting once…");
    try {
      const tx = await sendWrite(selected.provider, account, "create_case", [
        form.caseId, "npm", form.packageName, form.version,
        `https://registry.npmjs.org/${form.packageName}/${form.version}`,
        form.repositoryOwner, form.repositoryName,
        `https://github.com/${form.repositoryOwner.toLowerCase()}/${form.repositoryName.toLowerCase()}/releases/tag/${form.version}`,
        form.expectedCommit.toLowerCase(), form.sourceSubdirectory,
      ]);
      setHash(tx); await waitForSuccess(tx, setStatus);
      const refreshed = await getCase(form.caseId); setResult(refreshed); setCaseId(form.caseId); setCount((value) => value === null ? value : value + 1); setStatus("Created and verified");
    } catch (cause) { setStatus("Needs attention"); setError(userFacingError(cause, "That action could not be completed. Check your wallet and try again.")); }
  }

  async function loadCase(event: FormEvent) {
    event.preventDefault(); setError("");
    try { setResult(await getCase(caseId)); } catch (cause) { setError(userFacingError(cause, "We could not load that case. Check the case ID and try again.")); }
  }

  async function runWrite(method: "freeze_case" | "assess_case" | "retry_unresolved") {
    if (!selected || !account || !caseId) { setError("Connect a wallet and load a case first."); return; }
    setError(""); setStatus("Submitting once…");
    try { const tx = await sendWrite(selected.provider, account, method, [caseId]); setHash(tx); await waitForSuccess(tx, setStatus); setResult(await getCase(caseId)); setStatus({ freeze_case: "Provenance locked", assess_case: "Assessment complete", retry_unresolved: "Retry complete" }[method]); } catch (cause) { setError(userFacingError(cause, "That action could not be completed. Check your wallet and try again.")); }
  }

  return <>
  <main ref={mainRef}>
    <header className="topbar"><div><span className="eyebrow">GENLAYER · STUDIONET</span><h1>Provenance Register</h1></div><button ref={connectButtonRef} className="wallet" type="button" onClick={openPicker}>{connectedLabel}</button></header>
    <section className="hero"><div><p className="eyebrow">Release integrity, made inspectable</p><h2>Bind a package version to the source release it claims.</h2><p className="lede">A consensus-verified register for registry metadata, GitHub tags, immutable commits, and source subdirectories.</p></div><div className="stat"><span>Registered cases</span><strong>{count ?? "—"}</strong></div></section>
    <section className="workspace"><div className="panel"><div className="panel-head"><div><span className="eyebrow">01 · REGISTER</span><h3>Freeze provenance inputs</h3></div><span className="status-dot">{status}</span></div><form onSubmit={submit} className="form-grid">
      {(["caseId", "packageName", "version", "repositoryOwner", "repositoryName", "expectedCommit", "sourceSubdirectory"] as const).map((field) => <label key={field}>{field === "expectedCommit" ? "Expected full commit" : field.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}<input required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={field === "expectedCommit" ? "40 lowercase hex characters" : field === "sourceSubdirectory" ? "src" : ""} /></label>)}
      <button className="primary" type="submit">Create case <span>↗</span></button>
    </form></div><div className="panel detail"><div className="panel-head"><div><span className="eyebrow">02 · INSPECT</span><h3>Case detail</h3></div><span className="state">{result?.state ?? "NO CASE LOADED"}</span></div><form onSubmit={loadCase} className="lookup"><input value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="Enter case ID" /><button className="secondary">Load</button></form>{result ? <div className="result"><div className="outcome">{result.outcome || "Awaiting assessment"}</div><dl><div><dt>Package</dt><dd>{result.package_name}@{result.version}</dd></div><div><dt>Repository</dt><dd>{result.repository_owner}/{result.repository_name}</dd></div><div><dt>Expected commit</dt><dd className="mono">{result.expected_commit_id}</dd></div><div><dt>Observed commit</dt><dd className="mono">{result.observed_commit_id || "—"}</dd></div></dl><div className="actions"><button onClick={() => runWrite("freeze_case")} disabled={result.state !== "DRAFT"}>Freeze</button><button onClick={() => runWrite("assess_case")} disabled={!(["FROZEN", "RETRYING"].includes(result.state))}>Assess</button><button onClick={() => runWrite("retry_unresolved")} disabled={result.state !== "UNRESOLVED" || result.retry_count >= 2}>Retry {result.retry_count}/2</button></div></div> : <p className="empty">Load a frozen case to inspect its independently derived result.</p>}</div></section>
    {error && <div className="alert" role="alert">{error}</div>}{hash && <div className="receipt"><span>Transaction</span><a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer">{hash}</a></div>}
  </main>
  {chooserOpen && <div className="backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closePicker()}><section ref={dialogRef} className="chooser" role="dialog" aria-modal="true" aria-labelledby="chooser-title" tabIndex={-1} onKeyDown={handlePickerKeyDown}><button className="close" type="button" aria-label="Close wallet chooser" onClick={closePicker}>×</button><span className="eyebrow">SECURE CONNECTION</span><h3 id="chooser-title">Choose a wallet</h3>{connectionError && <p className="chooser-error" role="alert" aria-live="assertive">{connectionError}</p>}{providers.length ? <div className="provider-list">{providers.map((provider) => <button className="provider" type="button" data-wallet-option key={provider.uuid} disabled={Boolean(connectingUuid)} onClick={() => connect(provider)}><img src={provider.icon} alt="" width="32" height="32" /><span className="provider-copy"><strong>{provider.name}</strong><small>{providerDescriptions[provider.name]}</small></span><span className="provider-arrow" aria-hidden="true">→</span></button>)}</div> : <p className="empty">No compatible wallet was found. Install a supported wallet and try again.</p>}<button className="picker-cancel" type="button" onClick={closePicker}>Cancel</button></section></div>}
  </>;
}
