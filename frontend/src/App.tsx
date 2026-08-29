import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  useEffect(() => { listenForProviders(setProviders); }, []);
  useEffect(() => {
    if (!selected?.provider || !account || !selected.provider.on) return;
    const accountsChanged = (...args: unknown[]) => {
      const next = args[0];
      setAccount(Array.isArray(next) && typeof next[0] === "string" ? next[0] as `0x${string}` : null);
      setResult(null);
      setStatus("Wallet account changed; readback cleared");
    };
    const chainChanged = () => { setResult(null); setStatus("Network changed; reconnect required"); };
    selected.provider.on("accountsChanged", accountsChanged);
    selected.provider.on("chainChanged", chainChanged);
    return () => {
      selected.provider.removeListener?.("accountsChanged", accountsChanged);
      selected.provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [selected, account]);
  useEffect(() => {
    let active = true;
    getCount().then((value) => active && setCount(value)).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const connectedLabel = useMemo(() => account ? `${selected?.name ?? "Wallet"} · ${account.slice(0, 6)}…${account.slice(-4)}` : "Disconnected", [account, selected]);

  async function connect(provider: ProviderInfo) {
    setError("");
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet connection failed."); }
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
    } catch (cause) { setStatus("Needs attention"); setError(cause instanceof Error ? cause.message : "Write failed; reconcile by transaction hash."); }
  }

  async function loadCase(event: FormEvent) {
    event.preventDefault(); setError("");
    try { setResult(await getCase(caseId)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Case read failed."); }
  }

  async function runWrite(method: "freeze_case" | "assess_case" | "retry_unresolved") {
    if (!selected || !account || !caseId) { setError("Connect a wallet and load a case first."); return; }
    setError(""); setStatus("Submitting once…");
    try { const tx = await sendWrite(selected.provider, account, method, [caseId]); setHash(tx); await waitForSuccess(tx, setStatus); setResult(await getCase(caseId)); setStatus(`${method} verified`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Transaction failed; verify the hash and readback."); }
  }

  return <main>
    <header className="topbar"><div><span className="eyebrow">GENLAYER · STUDIONET</span><h1>Provenance Register</h1></div><button className="wallet" onClick={() => { setProviders(discoverProviders()); setChooserOpen(true); }}>{connectedLabel}</button></header>
    <section className="hero"><div><p className="eyebrow">Release integrity, made inspectable</p><h2>Bind a package version to the source release it claims.</h2><p className="lede">A consensus-verified register for registry metadata, GitHub tags, immutable commits, and source subdirectories.</p></div><div className="stat"><span>Registered cases</span><strong>{count ?? "—"}</strong></div></section>
    <section className="workspace"><div className="panel"><div className="panel-head"><div><span className="eyebrow">01 · REGISTER</span><h3>Freeze provenance inputs</h3></div><span className="status-dot">{status}</span></div><form onSubmit={submit} className="form-grid">
      {(["caseId", "packageName", "version", "repositoryOwner", "repositoryName", "expectedCommit", "sourceSubdirectory"] as const).map((field) => <label key={field}>{field === "expectedCommit" ? "Expected full commit" : field.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}<input required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={field === "expectedCommit" ? "40 lowercase hex characters" : field === "sourceSubdirectory" ? "src" : ""} /></label>)}
      <button className="primary" type="submit">Create case <span>↗</span></button>
    </form></div><div className="panel detail"><div className="panel-head"><div><span className="eyebrow">02 · INSPECT</span><h3>Case detail</h3></div><span className="state">{result?.state ?? "NO CASE LOADED"}</span></div><form onSubmit={loadCase} className="lookup"><input value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="Enter case ID" /><button className="secondary">Load</button></form>{result ? <div className="result"><div className="outcome">{result.outcome || "Awaiting assessment"}</div><dl><div><dt>Package</dt><dd>{result.package_name}@{result.version}</dd></div><div><dt>Repository</dt><dd>{result.repository_owner}/{result.repository_name}</dd></div><div><dt>Expected commit</dt><dd className="mono">{result.expected_commit_id}</dd></div><div><dt>Observed commit</dt><dd className="mono">{result.observed_commit_id || "—"}</dd></div></dl><div className="actions"><button onClick={() => runWrite("freeze_case")} disabled={result.state !== "DRAFT"}>Freeze</button><button onClick={() => runWrite("assess_case")} disabled={!(["FROZEN", "RETRYING"].includes(result.state))}>Assess</button><button onClick={() => runWrite("retry_unresolved")} disabled={result.state !== "UNRESOLVED" || result.retry_count >= 2}>Retry {result.retry_count}/2</button></div></div> : <p className="empty">Load a frozen case to inspect its independently derived result.</p>}</div></section>
    {error && <div className="alert" role="alert">{error}</div>}{hash && <div className="receipt"><span>Transaction</span><a href={`${EXPLORER_URL}/tx/${hash}`} target="_blank" rel="noreferrer">{hash}</a></div>}
    {chooserOpen && <div className="backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setChooserOpen(false)}><section className="chooser" role="dialog" aria-modal="true" aria-labelledby="chooser-title"><button className="close" aria-label="Close wallet chooser" onClick={() => setChooserOpen(false)}>×</button><span className="eyebrow">SECURE CONNECTION</span><h3 id="chooser-title">Choose your wallet</h3><p>Opening this chooser makes no wallet request.</p>{providers.length ? providers.map((provider) => <button className="provider" key={provider.uuid} onClick={() => connect(provider)}>{provider.icon && <img src={provider.icon} alt="" />}<span>{provider.name}</span><span>→</span></button>) : <p className="empty">No MetaMask, OKX Wallet, or Rabby provider detected.</p>}</section></div>}
  </main>;
}
