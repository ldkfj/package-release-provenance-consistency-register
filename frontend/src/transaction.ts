export type TransactionLike = {
  statusName?: unknown;
  status?: unknown;
  resultName?: unknown;
  result_name?: unknown;
  result?: unknown;
  txExecutionResult?: unknown;
  txExecutionResultName?: unknown;
  consensus_data?: {
    leader_receipt?: ReceiptLike | ReceiptLike[];
  };
};

type ReceiptLike = {
  execution_result?: unknown;
  result?: unknown;
};

export type TransactionDecision =
  | { kind: "pending"; status: string }
  | { kind: "success"; status: "FINALIZED" }
  | { kind: "failure"; status: string; reason: string };

function leaderReceipt(transaction: TransactionLike): ReceiptLike | undefined {
  const receipt = transaction.consensus_data?.leader_receipt;
  return Array.isArray(receipt) ? receipt[0] : receipt;
}

function executionResultName(transaction: TransactionLike): string {
  const explicit = String(transaction.txExecutionResultName ?? "").toUpperCase();
  if (explicit) return explicit;

  const numeric = String(transaction.txExecutionResult ?? "");
  if (numeric === "1") return "FINISHED_WITH_RETURN";
  if (numeric === "2") return "FINISHED_WITH_ERROR";
  if (numeric === "0") return "NOT_VOTED";

  // Studionet's current raw client shape exposes the terminal execution
  // signal on the leader receipt instead of txExecutionResultName.
  const raw = String(leaderReceipt(transaction)?.execution_result ?? "").toUpperCase();
  if (raw === "SUCCESS") return "FINISHED_WITH_RETURN";
  if (raw === "ERROR") return "FINISHED_WITH_ERROR";
  return raw;
}

function terminalFailureReason(transaction: TransactionLike, execution: string, result: string): string {
  const receiptResult = leaderReceipt(transaction)?.result;
  if (receiptResult && typeof receiptResult === "object" && "payload" in receiptResult) {
    const payload = (receiptResult as { payload?: unknown }).payload;
    if (typeof payload === "string" && payload) return payload;
  }
  if (typeof receiptResult === "string" && receiptResult) return receiptResult;
  return execution || result || "UNKNOWN_EXECUTION";
}

export function classifyTransaction(transaction: TransactionLike): TransactionDecision {
  const status = String(transaction.statusName ?? transaction.status ?? "").toUpperCase();
  const rawResult = transaction.resultName ?? transaction.result_name ?? transaction.result;
  const result = typeof rawResult === "number" || /^\d+$/.test(String(rawResult ?? ""))
    ? ({ 0: "IDLE", 1: "AGREE", 2: "DISAGREE", 3: "TIMEOUT", 4: "DETERMINISTIC_VIOLATION", 5: "NO_MAJORITY", 6: "MAJORITY_AGREE", 7: "MAJORITY_DISAGREE" } as Record<string, string>)[String(rawResult)] ?? ""
    : String(rawResult ?? "").toUpperCase();
  const execution = executionResultName(transaction);
  if (status === "FINALIZED" && execution === "FINISHED_WITH_RETURN" && ["AGREE", "MAJORITY_AGREE"].includes(result)) {
    return { kind: "success", status: "FINALIZED" };
  }
  if (status === "FINALIZED") {
    return { kind: "failure", status, reason: execution === "FINISHED_WITH_RETURN" ? result || "UNKNOWN_CONSENSUS_RESULT" : terminalFailureReason(transaction, execution, result) };
  }
  if (["CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(status)) return { kind: "failure", status, reason: execution || status };
  return { kind: "pending", status: status || "PENDING" };
}
