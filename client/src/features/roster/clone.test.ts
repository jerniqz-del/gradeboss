import { describe, expect, it } from "vitest";
import { createTeachingLoad } from "../teaching-loads/create-load";
import { cloneRosterOntoLoad } from "./clone";
import { createLearner } from "./learner";

function load(section: string, learners: ReturnType<typeof createLearner>[]) {
  const next = createTeachingLoad({
    gradeLevel: "10",
    section,
    subject: "Mathematics",
    schoolYear: "2026-2027",
  });
  next.learners = learners;
  return next;
}

describe("cloneRosterOntoLoad", () => {
  it("merges missing learners and skips LRN/name duplicates", () => {
    const source = load("Rizal", [
      createLearner({ lrn: "123456789012", lastName: "Santos", firstName: "Juan", sex: "M" }),
      createLearner({ lrn: "123456789013", lastName: "Reyes", firstName: "Maria", sex: "F" }),
    ]);
    const target = load("Rizal-Science", [
      createLearner({ lrn: "123456789012", lastName: "Santos", firstName: "Juan", sex: "M" }),
    ]);
    const result = cloneRosterOntoLoad(source, target, "merge");
    expect(result.learners).toHaveLength(2);
    expect(result.learners.some((item) => item.lastName === "Reyes")).toBe(true);
    expect(result.learners.find((item) => item.lrn === "123456789012")?.id).toBe(target.learners[0].id);
  });

  it("overwrite replaces the roster and clears scores", () => {
    const source = load("A", [createLearner({ lastName: "New", firstName: "Kid", sex: "F" })]);
    const target = load("B", [createLearner({ lastName: "Old", firstName: "Kid", sex: "M" })]);
    target.scores["x|y"] = 10;
    const result = cloneRosterOntoLoad(source, target, "overwrite");
    expect(result.learners).toHaveLength(1);
    expect(result.learners[0].lastName).toBe("New");
    expect(result.learners[0].id).not.toBe(source.learners[0].id);
    expect(result.scores).toEqual({});
  });
});
