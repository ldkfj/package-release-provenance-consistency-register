import type { Eip1193Provider, ProviderInfo } from "./types";

type Announcement = { info?: Record<string, unknown>; provider?: Eip1193Provider };

const SUPPORTED = new Set(["MetaMask", "OKX Wallet", "Rabby"]);
const fallbackNames = new Map<string, string>([
  ["io.metamask", "MetaMask"],
  ["com.okex.wallet", "OKX Wallet"],
  ["io.rabby", "Rabby"],
]);

function validProvider(value: unknown): value is Eip1193Provider {
  return !!value && typeof value === "object" && typeof (value as Eip1193Provider).request === "function";
}

function displayName(info: Record<string, unknown>, provider: Eip1193Provider): string {
  const name = typeof info.name === "string" ? info.name : "";
  if (SUPPORTED.has(name)) return name;
  const rdns = typeof info.rdns === "string" ? info.rdns : "";
  return fallbackNames.get(rdns) ?? name;
}

export function discoverProviders(win: Window = window): ProviderInfo[] {
  const found: ProviderInfo[] = [];
  const seenObjects = new Set<Eip1193Provider>();
  const seenUuids = new Set<string>();
  const add = (uuid: string, info: Record<string, unknown>, provider: Eip1193Provider) => {
    if (!validProvider(provider) || seenObjects.has(provider) || seenUuids.has(uuid)) return;
    const name = displayName(info, provider);
    if (!SUPPORTED.has(name)) return;
    seenObjects.add(provider);
    seenUuids.add(uuid);
    found.push({
      uuid,
      name,
      icon: typeof info.icon === "string" ? info.icon : undefined,
      rdns: typeof info.rdns === "string" ? info.rdns : undefined,
      provider,
    });
  };

  const announcements = (win as Window & { __eip6963?: Announcement[] }).__eip6963 ?? [];
  for (const announcement of announcements) {
    const info = announcement.info;
    if (info && typeof info.uuid === "string" && announcement.provider) add(info.uuid, info, announcement.provider);
  }
  const legacy = (win as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (found.length === 0 && validProvider(legacy)) {
    const rdns = typeof (legacy as Eip1193Provider & { rdns?: unknown }).rdns === "string"
      ? (legacy as Eip1193Provider & { rdns: string }).rdns
      : "";
    const name = fallbackNames.get(rdns) ?? "MetaMask";
    add(`legacy-${name}`, { name, rdns }, legacy);
  }
  return found;
}

export function listenForProviders(onChange: (providers: ProviderInfo[]) => void): () => void {
  const announcements = new Map<string, Announcement>();
  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<Announcement>).detail;
    const uuid = detail?.info?.uuid;
    if (detail?.info && detail.provider && typeof uuid === "string") {
      announcements.set(uuid, detail);
      (window as Window & { __eip6963?: Announcement[] }).__eip6963 = [...announcements.values()];
      onChange(discoverProviders());
    }
  };
  window.addEventListener("eip6963:announceProvider", onAnnouncement);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  onChange(discoverProviders());
  // EIP-6963 discovery is page-scoped and must stay active for the page lifetime.
  return () => undefined;
}
