import { describe, expect, it } from "vitest";
import { scoreKey } from "../../models/assessment";
import { computeTermResult } from "../../domain/grading";
import { createTeachingLoad } from "../teaching-loads/create-load";
import { createLearner } from "./learner";
import { transferLearnerBetweenLoads } from "./transfer";

function scoredLoad() {
  const load = createTeachingLoad({
    gradeLevel: "10",
    section: "Rizal",
    subject: "Mathematics",
    schoolYear: "2026-2027",
  });
  const learner = createLearner({
    lrn: "123456789012",
    lastName: "Santos",
    firstName: "Juan",
    sex: "M",
  });
  load.learners = [learner];
  for (const assessment of load.assessments.filter((item) => item.term === "1")) {
    assessment.maxScore = 50;
    load.scores[scoreKey(learner.id, assessment.id)] = 40;
  }
  return { load, learner };
}

describe("transferLearnerBetweenLoads", () => {
  it("moves a learner with no scores as a clean transfer", () => {
    const source = createTeachingLoad({
      gradeLevel: "10",
      section: "Rizal",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const target = createTeachingLoad({
      gradeLevel: "10",
      section: "Bonifacio",
      subject: "Mathematics",
      schoolYear: "2026-2027",
    });
    const learner = createLearner({ lastName: "Reyes", firstName: "Maria", sex: "F" });
    source.learners = [learner];

    const result = transferLearnerBetweenLoads(source, target, learner.id, "1");
    expect(result.source.learners).toHaveLength(0);
    expect(result.target.learners).toHaveLength(1);
    expect(result.target.learners[0].id).toBe(learner.id);
    expect(result.target.learners[0].transferredOutTerm).toBeUndefined();
    expect(result.target.learners[0].transferredInGrades).toBeUndefined();
  });

  it("marks T/O on the source and copies completed term grades to T/I", () => {
    const { load: source, learner } = scoredLoad();
    const target = createTeachingLoad({
      gradeLevel: "10",
      section: "Bonifacio",
      subject: "Science",
      schoolYear: "2026-2027",
    });
    const termGrade = computeTermResult(source, learner.id, "1").termGrade;
    expect(typeof termGrade).toBe("number");

    const result = transferLearnerBetweenLoads(source, target, learner.id, "1");
    const sourceLearner = result.source.learners.find((item) => item.id === learner.id);
    const targetLearner = result.target.learners[0];
    expect(sourceLearner?.transferredOutTerm).toBe("1");
    expect(targetLearner.id).not.toBe(learner.id);
    expect(targetLearner.transferredInGrades?.["1"]).toBe(termGrade);

    const later = computeTermResult(result.source, learner.id, "2");
    expect(later.termGrade).toBe("T/O");
    expect(later.isTransferredOut).toBe(true);

    const incoming = computeTermResult(result.target, targetLearner.id, "1");
    expect(incoming.termGrade).toBe(termGrade);
    expect(incoming.isTransferredIn).toBe(true);
  });
});
