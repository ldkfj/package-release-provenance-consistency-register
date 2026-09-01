import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import type { CalldataEncodable, Hash } from "genlayer-js/types";
import type { Address } from "viem";
import type { CaseResult, ContractCase, Eip1193Provider } from "./types";
import { classifyTransaction } from "./transaction";

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? "") as `0x${string}`;
export const EXPLORER_URL = import.meta.env.VITE_STUDIONET_EXPLORER_URL ?? studionet.blockExplorers?.default.url ?? "https://explorer-studio.genlayer.com";
export const STUDIONET_CHAIN_ID = `0x${studionet.id.toString(16)}`;
export const STUDIONET_CHAIN = {
  chainId: STUDIONET_CHAIN_ID,
  chainName: studionet.name,
  nativeCurrency: studionet.nativeCurrency,
  rpcUrls: [...studionet.rpcUrls.default.http],
  blockExplorerUrls: [EXPLORER_URL],
};

const readClient = createClient({ chain: studionet });
const inflight = new Map<string, Promise<unknown>>();

function read(key: string, fn: () => Promise<unknown>): Promise<unknown> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const request = fn().finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

function ensureAddress(): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS)) throw new Error("Contract address is not configured.");
  return CONTRACT_ADDRESS;
}

function decode(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") throw new Error("Contract returned an unexpected result.");
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Contract result is not an object.");
  return parsed as Record<string, unknown>;
}

export type ReadOptions = { finalized?: boolean };

function readVariant(options?: ReadOptions): TransactionHashVariant {
  return options?.finalized ? TransactionHashVariant.LATEST_FINAL : TransactionHashVariant.LATEST_NONFINAL;
}

export async function getCount(options?: ReadOptions): Promise<number> {
  const variant = readVariant(options);
  const value = await read(`count:${variant}`, () => readClient.readContract({ address: ensureAddress(), functionName: "get_count", args: [], transactionHashVariant: variant }));
  return Number(value);
}

export async function getCase(caseId: string, options?: ReadOptions): Promise<ContractCase> {
  const variant = readVariant(options);
  const value = await read(`case:${caseId}:${variant}`, () => readClient.readContract({ address: ensureAddress(), functionName: "get_case", args: [caseId], transactionHashVariant: variant }));
  return decode(value) as unknown as ContractCase;
}

export async function getResult(caseId: string, options?: ReadOptions): Promise<CaseResult> {
  const variant = readVariant(options);
  const value = await read(`result:${caseId}:${variant}`, () => readClient.readContract({ address: ensureAddress(), functionName: "get_result", args: [caseId], transactionHashVariant: variant }));
  return decode(value) as unknown as CaseResult;
}

export function createWriteClient(provider: Eip1193Provider, account: `0x${string}`) {
  return createClient({ chain: studionet, provider, account: account as Address });
}

export async function sendWrite(provider: Eip1193Provider, account: `0x${string}`, functionName: string, args: unknown[]): Promise<`0x${string}`> {
  await ensureSufficientBalance(provider, account);
  const client = createWriteClient(provider, account);
  const hash = await client.writeContract({ address: ensureAddress(), functionName, args: args as CalldataEncodable[], value: 0n });
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Wallet returned an invalid transaction hash.");
  return hash as `0x${string}`;
}

export async function ensureSufficientBalance(provider: Eip1193Provider, account: `0x${string}`): Promise<void> {
  const value = await provider.request({ method: "eth_getBalance", params: [account, "latest"] });
  const text = typeof value === "string" ? value : "";
  if (!/^0x[0-9a-fA-F]+$/.test(text) || BigInt(text) <= 0n) {
    throw new Error("Wallet balance is insufficient for this action.");
  }
}

export async function waitForSuccess(hash: `0x${string}`, onStatus: (status: string) => void): Promise<void> {
  const client = readClient;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const tx = await client.getTransaction({ hash: hash as Hash });
    const decision = classifyTransaction(tx);
    onStatus(decision.status);
    if (decision.kind === "success") return;
    if (decision.kind === "failure") throw new Error(`Transaction ended as ${decision.status}: ${decision.reason}.`);
    await new Promise((resolve) => window.setTimeout(resolve, Math.min(3000, 250 * 2 ** Math.min(attempt, 3))));
  }
  throw new Error("Transaction did not reach finality within the bounded wait.");
}
