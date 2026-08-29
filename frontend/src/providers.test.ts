import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverProviders, listenForProviders } from "./providers";
import type { Eip1193Provider } from "./types";

function provider(): Eip1193Provider { return { request: vi.fn() }; }

describe("EIP-6963 provider discovery", () => {
  beforeEach(() => {
    delete (window as Window & { ethereum?: unknown; __eip6963?: unknown }).ethereum;
    delete (window as Window & { __eip6963?: unknown }).__eip6963;
  });

  it("returns only supported announced wallets and deduplicates a repeated UUID", () => {
    const metamask = provider();
    (window as Window & { __eip6963?: unknown[] }).__eip6963 = [
      { info: { uuid: "m1", name: "MetaMask" }, provider: metamask },
      { info: { uuid: "m1", name: "MetaMask" }, provider: metamask },
      { info: { uuid: "x1", name: "Unsupported" }, provider: provider() },
    ];
    expect(discoverProviders()).toHaveLength(1);
    expect(discoverProviders()[0].name).toBe("MetaMask");
  });

  it("uses legacy fallback only when no EIP-6963 wallet exists", () => {
    const legacy = provider();
    (window as Window & { ethereum?: Eip1193Provider }).ethereum = legacy;
    expect(discoverProviders()[0].provider).toBe(legacy);
    const announced = provider();
    (window as Window & { __eip6963?: unknown[] }).__eip6963 = [{ info: { uuid: "r1", name: "Rabby" }, provider: announced }];
    expect(discoverProviders()).toEqual([expect.objectContaining({ name: "Rabby", provider: announced })]);
  });

  it("updates a re-announcement instead of adding a duplicate option", () => {
    const first = provider(); const second = provider();
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const onChange = vi.fn();
    listenForProviders(onChange);
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "r1", name: "Rabby" }, provider: first } }));
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "r1", name: "Rabby" }, provider: second } }));
    expect(onChange.mock.lastCall?.[0]).toEqual([expect.objectContaining({ provider: second })]);
    dispatch.mockRestore();
  });
});
