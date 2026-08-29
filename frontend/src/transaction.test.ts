import { describe, expect, it } from "vitest";
import { classifyTransaction } from "./transaction";

describe("GenLayer transaction classification", () => {
  it("requires finality and semantic execution success", () => {
    expect(classifyTransaction({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toEqual({ kind: "success", status: "FINALIZED" });
    expect(classifyTransaction({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })).toEqual({ kind: "failure", status: "FINALIZED", reason: "FINISHED_WITH_ERROR" });
  });

  it("keeps pending and timeout states out of success", () => {
    expect(classifyTransaction({ statusName: "ACCEPTED" }).kind).toBe("pending");
    expect(classifyTransaction({ statusName: "LEADER_TIMEOUT" }).kind).toBe("failure");
  });
});
