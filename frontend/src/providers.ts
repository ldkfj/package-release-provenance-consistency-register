import type { Eip1193Provider, ProviderInfo } from "./types";

type Announcement = { info?: Record<string, unknown>; provider?: Eip1193Provider };

const SUPPORTED = new Set(["MetaMask", "OKX Wallet", "Rabby"]);
const NAMES_BY_RDNS = new Map([
  ["io.metamask", "MetaMask"],
  ["com.okex.wallet", "OKX Wallet"],
  ["io.rabby", "Rabby"],
]);
const ICONS_BY_NAME = new Map([
  ["MetaMask", "/wallet-icons/metamask.svg"],
  ["OKX Wallet", "/wallet-icons/okx-wallet.svg"],
  ["Rabby", "/wallet-icons/rabby.svg"],
]);
const LEGACY_UUID = "legacy-window-ethereum";
const EMPTY: readonly ProviderInfo[] = Object.freeze([]);

const byUuid = new Map<string, ProviderInfo>();
const uuidByProvider = new WeakMap<object, string>();
const subscribers = new Set<(providers: ProviderInfo[]) => void>();
let snapshot: readonly ProviderInfo[] = EMPTY;
let initializedWindow: Window | null = null;

function validProvider(value: unknown): value is Eip1193Provider {
  return !!value && typeof value === "object" && typeof (value as Eip1193Provider).request === "function";
}

function supportedName(info: Record<string, unknown>): string {
  const name = typeof info.name === "string" ? info.name : "";
  if (SUPPORTED.has(name)) return name;
  const rdns = typeof info.rdns === "string" ? info.rdns : "";
  return NAMES_BY_RDNS.get(rdns) ?? "";
}

function iconFor(name: string, info: Record<string, unknown>): string {
  const icon = typeof info.icon === "string" ? info.icon : "";
  return icon.startsWith("data:") || icon.startsWith("https://") ? icon : ICONS_BY_NAME.get(name)!;
}

function providerInfo(uuid: string, info: Record<string, unknown>, provider: Eip1193Provider): ProviderInfo | null {
  if (!uuid || !validProvider(provider)) return null;
  const name = supportedName(info);
  if (!name) return null;
  return {
    uuid,
    name,
    icon: iconFor(name, info),
    rdns: typeof info.rdns === "string" ? info.rdns : undefined,
    provider,
  };
}

function publish(win: Window): void {
  if (byUuid.size === 0) {
    const legacy = (win as Window & { ethereum?: Eip1193Provider }).ethereum;
    if (validProvider(legacy)) {
      const rdns = typeof (legacy as Eip1193Provider & { rdns?: unknown }).rdns === "string"
        ? (legacy as Eip1193Provider & { rdns: string }).rdns
        : "";
      const name = NAMES_BY_RDNS.get(rdns) ?? "MetaMask";
      byUuid.set(LEGACY_UUID, {
        uuid: LEGACY_UUID,
        name,
        icon: ICONS_BY_NAME.get(name),
        rdns: rdns || undefined,
        provider: legacy,
      });
      uuidByProvider.set(legacy as object, LEGACY_UUID);
    }
  }
  snapshot = Object.freeze([...byUuid.values()].sort((a, b) => a.name.localeCompare(b.name)));
  subscribers.forEach((notify) => notify([...snapshot]));
}

function acceptAnnouncement(event: Event): void {
  const detail = (event as CustomEvent<Announcement>).detail;
  const info = detail?.info;
  const uuid = info?.uuid;
  if (!info || typeof uuid !== "string" || !detail.provider) return;
  const normalized = providerInfo(uuid, info, detail.provider);
  if (!normalized) return;

  const providerObject = normalized.provider as object;
  const priorUuid = uuidByProvider.get(providerObject);
  if (priorUuid && priorUuid !== uuid && priorUuid !== LEGACY_UUID) return;
  const prior = byUuid.get(uuid);
  if (prior && prior.provider !== normalized.provider) {
    uuidByProvider.delete(prior.provider as object);
  }
  byUuid.delete(LEGACY_UUID);
  uuidByProvider.set(providerObject, uuid);
  byUuid.set(uuid, normalized);
  publish(initializedWindow!);
}

function ensureDiscovery(win: Window): void {
  if (initializedWindow === win) return;
  initializedWindow = win;
  win.addEventListener("eip6963:announceProvider", acceptAnnouncement);
  // The listener is registered before the request, and remains page-scoped.
  win.dispatchEvent(new Event("eip6963:requestProvider"));
  publish(win);
}

export function discoverProviders(win: Window = window): ProviderInfo[] {
  ensureDiscovery(win);
  return [...snapshot];
}

export function listenForProviders(onChange: (providers: ProviderInfo[]) => void): () => void {
  ensureDiscovery(window);
  subscribers.add(onChange);
  onChange([...snapshot]);
  // Only the component subscription is torn down; discovery remains page-scoped.
  return () => subscribers.delete(onChange);
}

/** @internal — isolates the module registry for browser-unit tests. */
export function resetProviderDiscoveryForTests(): void {
  if (initializedWindow) initializedWindow.removeEventListener("eip6963:announceProvider", acceptAnnouncement);
  byUuid.clear();
  subscribers.clear();
  snapshot = EMPTY;
  initializedWindow = null;
}
