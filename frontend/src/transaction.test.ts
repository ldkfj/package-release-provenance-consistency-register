import { describe, expect, it } from "vitest";
import { classifyTransaction } from "./transaction";

describe("GenLayer transaction classification", () => {
  it("requires finality and semantic execution success", () => {
    expect(classifyTransaction({ statusName: "FINALIZED", resultName: "AGREE", txExecutionResultName: "FINISHED_WITH_RETURN" })).toEqual({ kind: "success", status: "FINALIZED" });
    expect(classifyTransaction({ statusName: "FINALIZED", resultName: "MAJORITY_AGREE", txExecutionResultName: "FINISHED_WITH_RETURN" })).toEqual({ kind: "success", status: "FINALIZED" });
    expect(classifyTransaction({ statusName: "FINALIZED", resultName: "DISAGREE", txExecutionResultName: "FINISHED_WITH_RETURN" })).toEqual({ kind: "failure", status: "FINALIZED", reason: "DISAGREE" });
    expect(classifyTransaction({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })).toEqual({ kind: "failure", status: "FINALIZED", reason: "FINISHED_WITH_ERROR" });
  });

  it("keeps pending and timeout states out of success", () => {
    expect(classifyTransaction({ statusName: "ACCEPTED" }).kind).toBe("pending");
    expect(classifyTransaction({ statusName: "LEADER_TIMEOUT" }).kind).toBe("failure");
    expect(classifyTransaction({ statusName: "FINALIZED", result: 6, txExecutionResultName: "FINISHED_WITH_RETURN" }).kind).toBe("success");
  });
});
