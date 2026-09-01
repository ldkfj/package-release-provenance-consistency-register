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

describe("authoritative readback variants", () => {
  beforeAll(async () => {
    vi.stubEnv("VITE_CONTRACT_ADDRESS", `0x${"1".repeat(40)}`);
    ({ getCase, ensureSufficientBalance } = await import("./rpc"));
  });
  beforeEach(() => readContract.mockClear());

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
});
