export type TransactionLike = {
  statusName?: unknown;
  status?: unknown;
  resultName?: unknown;
  result?: unknown;
  txExecutionResultName?: unknown;
};

export type TransactionDecision =
  | { kind: "pending"; status: string }
  | { kind: "success"; status: "FINALIZED" }
  | { kind: "failure"; status: string; reason: string };

export function classifyTransaction(transaction: TransactionLike): TransactionDecision {
  const status = String(transaction.statusName ?? transaction.status ?? "").toUpperCase();
  const rawResult = transaction.resultName ?? transaction.result;
  const result = typeof rawResult === "number" || /^\d+$/.test(String(rawResult ?? ""))
    ? ({ 0: "IDLE", 1: "AGREE", 2: "DISAGREE", 3: "TIMEOUT", 4: "DETERMINISTIC_VIOLATION", 5: "NO_MAJORITY", 6: "MAJORITY_AGREE", 7: "MAJORITY_DISAGREE" } as Record<string, string>)[String(rawResult)] ?? ""
    : String(rawResult ?? "").toUpperCase();
  const execution = String(transaction.txExecutionResultName ?? "").toUpperCase();
  if (status === "FINALIZED" && execution === "FINISHED_WITH_RETURN" && ["AGREE", "MAJORITY_AGREE"].includes(result)) {
    return { kind: "success", status: "FINALIZED" };
  }
  if (status === "FINALIZED") {
    return { kind: "failure", status, reason: execution === "FINISHED_WITH_RETURN" ? result || "UNKNOWN_CONSENSUS_RESULT" : execution || "UNKNOWN_EXECUTION" };
  }
  if (["CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(status)) return { kind: "failure", status, reason: execution || status };
  return { kind: "pending", status: status || "PENDING" };
}
