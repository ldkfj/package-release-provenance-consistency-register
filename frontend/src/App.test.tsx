import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { canonicalRegistryUrl, publicTransactionStatus, userFacingError } from "./App";
import * as rpc from "./rpc";
import { resetProviderDiscoveryForTests } from "./providers";
import type { Eip1193Provider } from "./types";

const ACCOUNT = `0x${"1".repeat(40)}`;
const OTHER_ACCOUNT = `0x${"2".repeat(40)}`;

vi.mock("./rpc", () => ({
  EXPLORER_URL: "https://explorer.example",
  STUDIONET_CHAIN: {},
  STUDIONET_CHAIN_ID: "0xf22f",
  getCase: vi.fn(),
  getCount: vi.fn(async () => 0),
  sendWrite: vi.fn(),
  waitForSuccess: vi.fn(),
}));

function wallet(overrides: Partial<Eip1193Provider> = {}): Eip1193Provider {
  return { request: vi.fn(async ({ method }) => method === "eth_requestAccounts" ? [ACCOUNT] : "0xf22f"), ...overrides };
}

function announce(uuid: string, name: string, provider: Eip1193Provider): void {
  window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
    detail: { info: { uuid, name }, provider },
  }));
}

async function renderApp(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<App />); await Promise.resolve(); });
  return { container, root };
}

async function flushFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

describe("public wallet picker", () => {
  const roots: Root[] = [];

  beforeEach(() => {
    resetProviderDiscoveryForTests();
    delete (window as Window & { ethereum?: unknown }).ethereum;
  });

  afterEach(() => {
    roots.splice(0).forEach((root) => act(() => root.unmount()));
    document.body.replaceChildren();
  });

  it("canonicalizes scoped npm registry URLs", () => {
    expect(canonicalRegistryUrl("@scope/package", "1.2.3")).toBe("https://registry.npmjs.org/@scope%2fpackage/1.2.3");
    expect(canonicalRegistryUrl("package", "1.2.3")).toBe("https://registry.npmjs.org/package/1.2.3");
  });

  it("keeps duplicate provenance errors in the contract fault domain", () => {
    expect(userFacingError(new Error("Transaction ended as FINALIZED: ERR_DUPLICATE_PROVENANCE."), "fallback")).toContain("already registered");
  });

  it("maps pending lifecycle states to clear public progress copy", () => {
    expect(publicTransactionStatus("PROPOSING")).toContain("Waiting for finality");
    expect(publicTransactionStatus("FINALIZED")).toContain("Verifying result");
  });

  it("opens without requesting accounts and lists each available wallet", async () => {
    const metamask = wallet();
    const okx = wallet();
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", metamask);
      announce("o1", "OKX Wallet", okx);
      await Promise.resolve();
    });
    await act(async () => { container.querySelector<HTMLButtonElement>(".wallet")?.click(); await flushFrame(); });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-wallet-option]")).toHaveLength(2);
    expect((container.querySelector("main") as HTMLElement & { inert: boolean }).inert).toBe(true);
    expect(metamask.request).not.toHaveBeenCalled();
    expect(okx.request).not.toHaveBeenCalled();

    await act(async () => { container.querySelector<HTMLButtonElement>(".picker-cancel")?.click(); await flushFrame(); });
    expect(metamask.request).not.toHaveBeenCalled();
    expect(okx.request).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(container.querySelector<HTMLButtonElement>(".wallet"));
  });

  it("requests connection only from the explicitly selected wallet", async () => {
    const metamask = wallet();
    const rabby = wallet();
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", metamask);
      announce("r1", "Rabby", rabby);
      await Promise.resolve();
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      await flushFrame();
    });
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>("[data-wallet-option]")[1].click();
      await Promise.resolve();
    });

    expect(rabby.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(metamask.request).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("requires an explicit selection when switching wallets", async () => {
    const metamask = wallet();
    const okx = wallet();
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", metamask);
      announce("o1", "OKX Wallet", okx);
      await Promise.resolve();
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      await flushFrame();
    });
    await act(async () => { container.querySelectorAll<HTMLButtonElement>("[data-wallet-option]")[0].click(); await Promise.resolve(); await flushFrame(); });
    expect(container.querySelector<HTMLButtonElement>(".wallet")?.textContent).toBe("Wallet connected");
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      await flushFrame();
    });
    expect(metamask.request).toHaveBeenCalledTimes(3);
    expect(okx.request).not.toHaveBeenCalled();
    await act(async () => { container.querySelectorAll<HTMLButtonElement>("[data-wallet-option]")[1].click(); await Promise.resolve(); });
    expect(okx.request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
  });

  it("traps focus in the picker and invalidates on disconnect or network change", async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const injected = wallet({
      on: vi.fn((event, listener) => listeners.set(event, listener)),
      removeListener: vi.fn(),
    });
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", injected);
      await Promise.resolve();
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      await flushFrame();
    });
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    const options = container.querySelectorAll<HTMLButtonElement>("[data-wallet-option]");
    const close = container.querySelector<HTMLButtonElement>(".close")!;
    const cancel = container.querySelector<HTMLButtonElement>(".picker-cancel")!;
    cancel.focus();
    await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })); });
    expect(document.activeElement).toBe(close);
    await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })); });
    expect(document.activeElement).toBe(cancel);
    await act(async () => { options[0].click(); await Promise.resolve(); await flushFrame(); });
    await act(async () => { listeners.get("disconnect")?.({ code: 4900 }); });
    expect(container.querySelector<HTMLButtonElement>(".wallet")?.textContent).toBe("Connect wallet");
  });

  it("keeps rejection inside the picker and restores focus on cancel and Escape", async () => {
    const rejected = wallet({ request: vi.fn(async () => { throw Object.assign(new Error("rejected"), { code: 4001 }); }) });
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", rejected);
      await Promise.resolve();
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-wallet-option]")?.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("canceled");

    await act(async () => { container.querySelector<HTMLButtonElement>(".picker-cancel")?.click(); await flushFrame(); });
    expect(document.activeElement).toBe(container.querySelector<HTMLButtonElement>(".wallet"));
    await act(async () => { container.querySelector<HTMLButtonElement>(".wallet")?.click(); });
    await act(async () => { container.querySelector<HTMLElement>('[role="dialog"]')?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await flushFrame(); });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector<HTMLButtonElement>(".wallet"));
  });

  it("invalidates the session on account change and starts disconnected after reload", async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const selected = wallet({
      on: vi.fn((event, listener) => listeners.set(event, listener)),
      removeListener: vi.fn(),
    });
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", selected);
      await Promise.resolve();
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      container.querySelector<HTMLButtonElement>("[data-wallet-option]")?.click();
      await Promise.resolve();
      await flushFrame();
    });
    await act(async () => { listeners.get("accountsChanged")?.([OTHER_ACCOUNT]); });
    expect(container.querySelector<HTMLButtonElement>(".wallet")?.textContent).toBe("Connect wallet");

    await act(async () => { root.unmount(); });
    const next = await renderApp();
    roots.push(next.root);
    expect(next.container.querySelector<HTMLButtonElement>(".wallet")?.textContent).toBe("Connect wallet");
  });

  it("invalidates the session when the wallet network changes", async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const injected = wallet({
      on: vi.fn((event, listener) => listeners.set(event, listener)),
      removeListener: vi.fn(),
    });
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", injected);
      await Promise.resolve();
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      container.querySelector<HTMLButtonElement>("[data-wallet-option]")?.click();
      await Promise.resolve();
      listeners.get("chainChanged")?.("0x1");
    });
    expect(container.querySelector<HTMLButtonElement>(".wallet")?.textContent).toBe("Connect wallet");
  });

  it("locks consequential writes while the first submission is in flight", async () => {
    const metamask = wallet();
    let release!: (hash: `0x${string}`) => void;
    vi.mocked(rpc.sendWrite).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const { container, root } = await renderApp();
    roots.push(root);
    await act(async () => {
      announce("m1", "MetaMask", metamask);
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".wallet")?.click();
      await flushFrame();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-wallet-option]")?.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.querySelector<HTMLButtonElement>(".wallet")?.textContent).toBe("Wallet connected");
    const form = container.querySelector<HTMLFormElement>(".form-grid")!;
    const values = ["case-rapid", "is-number", "7.0.0", "jonschlinkert", "is-number", "a".repeat(40)];
    form.querySelectorAll<HTMLInputElement>("input[required]").forEach((input, index) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, values[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".primary")?.click();
      container.querySelector<HTMLButtonElement>(".primary")?.click();
      await Promise.resolve();
    });
    expect(rpc.sendWrite).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLButtonElement>(".primary")?.disabled).toBe(true);
    expect(container.querySelector(".status-spinner")).not.toBeNull();
    await act(async () => {
      release(`0x${"a".repeat(64)}`);
      await Promise.resolve();
    });
  });

  it("shows a copy action for a retained transaction hash", async () => {
    const metamask = wallet();
    const hash = `0x${"b".repeat(64)}` as `0x${string}`;
    const writeText = vi.fn(async () => undefined);
    const priorClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.mocked(rpc.sendWrite).mockResolvedValueOnce(hash);
    vi.mocked(rpc.waitForSuccess).mockResolvedValueOnce();
    const { container, root } = await renderApp();
    roots.push(root);
    try {
      await act(async () => {
        announce("m1", "MetaMask", metamask);
        await Promise.resolve();
        container.querySelector<HTMLButtonElement>(".wallet")?.click();
        await flushFrame();
        container.querySelector<HTMLButtonElement>("[data-wallet-option]")?.click();
        await Promise.resolve();
      });
      const form = container.querySelector<HTMLFormElement>(".form-grid")!;
      const values = ["case-copy", "is-number", "7.0.0", "jonschlinkert", "is-number", "a".repeat(40)];
      form.querySelectorAll<HTMLInputElement>("input[required]").forEach((input, index) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, values[index]);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>(".primary")?.click();
        await Promise.resolve();
      });
      const copy = container.querySelector<HTMLButtonElement>(".copy-hash")!;
      expect(copy).not.toBeNull();
      await act(async () => { copy.click(); await Promise.resolve(); });
      expect(writeText).toHaveBeenCalledWith(hash);
      expect(copy.textContent).toBe("Copied");
    } finally {
      if (priorClipboard) Object.defineProperty(navigator, "clipboard", priorClipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});
