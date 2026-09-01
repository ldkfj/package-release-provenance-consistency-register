import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { readContract, getTransaction } = vi.hoisted(() => ({
  readContract: vi.fn(async () => JSON.stringify({ case_id: "case-1" })),
  getTransaction: vi.fn(),
}));

vi.mock("genlayer-js", () => ({
  createClient: vi.fn(() => ({ readContract, getTransaction })),
}));
vi.mock("genlayer-js/chains", () => ({
  studionet: {
    id: 61999,
    name: "Studionet",
    nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
    rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } },
    blockExplorers: { default: { url: "https://explorer-studio.genlayer.com" } },
  },
}));

let getCase: (caseId: string, options?: { finalized?: boolean }) => Promise<unknown>;
let ensureSufficientBalance: (provider: { request(args: { method: string; params?: unknown[] }): Promise<unknown> }, account: `0x${string}`) => Promise<void>;
let ensureSelectedAccountAndChain: (provider: { request(args: { method: string; params?: unknown[] }): Promise<unknown> }, account: `0x${string}`) => Promise<void>;
let waitForSuccess: (hash: `0x${string}`, onStatus: (status: string) => void) => Promise<void>;

describe("authoritative readback variants", () => {
  beforeAll(async () => {
    vi.stubEnv("VITE_CONTRACT_ADDRESS", `0x${"1".repeat(40)}`);
    ({ getCase, ensureSufficientBalance, ensureSelectedAccountAndChain, waitForSuccess } = await import("./rpc"));
  });
  beforeEach(() => {
    readContract.mockClear();
    getTransaction.mockReset();
  });

  it("uses latest-final for post-write readback and does not reuse nonfinal cache", async () => {
    await getCase("case-1");
    await getCase("case-1", { finalized: true });
    expect(readContract).toHaveBeenNthCalledWith(1, expect.objectContaining({ transactionHashVariant: "latest-nonfinal" }));
    expect(readContract).toHaveBeenNthCalledWith(2, expect.objectContaining({ transactionHashVariant: "latest-final" }));
  });

  it("requires a positive latest GEN balance before a write", async () => {
    const request = vi.fn(async () => "0x0");
    const account = ("0x" + "1".repeat(40)) as `0x${string}`;
    await expect(ensureSufficientBalance({ request }, account)).rejects.toThrow("balance");
    expect(request).toHaveBeenCalledWith({ method: "eth_getBalance", params: [account, "latest"] });
  });

  it("rechecks the selected account and Studionet chain before a write", async () => {
    const account = ("0x" + "1".repeat(40)) as `0x${string}`;
    const wrongAccount = ("0x" + "2".repeat(40)) as `0x${string}`;
    const request = vi.fn(async ({ method }: { method: string }): Promise<unknown> => method === "eth_accounts" ? [wrongAccount] : "0xf22f");
    await expect(ensureSelectedAccountAndChain({ request }, account)).rejects.toThrow("account");
    request.mockImplementation(async ({ method }: { method: string }): Promise<unknown> => method === "eth_accounts" ? [account] : "0x1");
    await expect(ensureSelectedAccountAndChain({ request }, account)).rejects.toThrow("Studionet");
  });

  it("uses the documented spendable GEN threshold", async () => {
    const account = ("0x" + "1".repeat(40)) as `0x${string}`;
    const request = vi.fn(async () => "0x38d7ea4c68000");
    await expect(ensureSufficientBalance({ request }, account)).resolves.toBeUndefined();
  });

  it("retries transient transaction-status failures without changing the hash", async () => {
    vi.useFakeTimers();
    getTransaction.mockRejectedValueOnce(new Error("429")).mockResolvedValueOnce({ statusName: "FINALIZED", resultName: "AGREE", txExecutionResultName: "FINISHED_WITH_RETURN" });
    const status = vi.fn();
    const promise = waitForSuccess(("0x" + "a".repeat(64)) as `0x${string}`, status);
    await vi.advanceTimersByTimeAsync(300);
    await expect(promise).resolves.toBeUndefined();
    expect(getTransaction).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
