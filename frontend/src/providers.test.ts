import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverProviders, listenForProviders, resetProviderDiscoveryForTests } from "./providers";
import type { Eip1193Provider } from "./types";

function provider(): Eip1193Provider {
  return { request: vi.fn() };
}

function announce(uuid: string, name: string, injected: Eip1193Provider, rdns?: string): void {
  window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
    detail: { info: { uuid, name, rdns }, provider: injected },
  }));
}

describe("supported wallet discovery", () => {
  beforeEach(() => {
    resetProviderDiscoveryForTests();
    delete (window as Window & { ethereum?: unknown }).ethereum;
  });

  it("shows no providers without EIP-6963 or legacy injection", () => {
    expect(discoverProviders()).toEqual([]);
  });

  it("lists all three supported wallets and ignores other brands", () => {
    const metamask = provider();
    const okx = provider();
    const rabby = provider();
    listenForProviders(vi.fn());
    announce("m1", "MetaMask", metamask, "io.metamask");
    announce("o1", "OKX Wallet", okx, "com.okex.wallet");
    announce("r1", "Rabby", rabby, "io.rabby");
    announce("x1", "Unsupported", provider());

    expect(discoverProviders().map(({ name }) => name)).toEqual(["MetaMask", "OKX Wallet", "Rabby"]);
    expect(discoverProviders().every(({ icon }) => Boolean(icon))).toBe(true);
  });

  it("deduplicates repeated UUIDs and updates the option", () => {
    const first = provider();
    const second = provider();
    listenForProviders(vi.fn());
    announce("r1", "Rabby", first, "io.rabby");
    announce("r1", "Rabby", second, "io.rabby");
    expect(discoverProviders()).toEqual([expect.objectContaining({ uuid: "r1", provider: second })]);
  });

  it("does not duplicate one provider object under another UUID", () => {
    const injected = provider();
    listenForProviders(vi.fn());
    announce("r1", "Rabby", injected, "io.rabby");
    announce("r2", "Rabby", injected, "io.rabby");
    expect(discoverProviders()).toHaveLength(1);
    expect(discoverProviders()[0].uuid).toBe("r1");
  });

  it("uses a legacy fallback only until a supported announcement arrives", () => {
    const legacy = provider();
    (window as Window & { ethereum?: Eip1193Provider }).ethereum = legacy;
    expect(discoverProviders()).toEqual([expect.objectContaining({ name: "MetaMask", provider: legacy })]);
    const announced = provider();
    listenForProviders(vi.fn());
    announce("r1", "Rabby", announced, "io.rabby");
    expect(discoverProviders()).toEqual([expect.objectContaining({ name: "Rabby", provider: announced })]);
    expect(legacy.request).not.toHaveBeenCalled();
  });

  it("opening discovery does not request accounts", () => {
    const injected = provider();
    (window as Window & { ethereum?: Eip1193Provider }).ethereum = injected;
    listenForProviders(vi.fn());
    expect(injected.request).not.toHaveBeenCalled();
  });
});
