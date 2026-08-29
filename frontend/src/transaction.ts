export type TransactionLike = {
  statusName?: unknown;
  status?: unknown;
  txExecutionResultName?: unknown;
};

export type TransactionDecision =
  | { kind: "pending"; status: string }
  | { kind: "success"; status: "FINALIZED" }
  | { kind: "failure"; status: string; reason: string };

export function classifyTransaction(transaction: TransactionLike): TransactionDecision {
  const status = String(transaction.statusName ?? transaction.status ?? "").toUpperCase();
  const execution = String(transaction.txExecutionResultName ?? "").toUpperCase();
  if (status === "FINALIZED" && execution === "FINISHED_WITH_RETURN") return { kind: "success", status: "FINALIZED" };
  if (status === "FINALIZED") return { kind: "failure", status, reason: execution || "UNKNOWN_EXECUTION" };
  if (["CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"].includes(status)) return { kind: "failure", status, reason: execution || status };
  return { kind: "pending", status: status || "PENDING" };
}
