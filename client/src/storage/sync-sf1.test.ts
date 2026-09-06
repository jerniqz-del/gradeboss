import { describe, expect, it } from "vitest";
import type { SchoolClass } from "../classes";
import { createTeachingLoad } from "../features/teaching-loads/create-load";
import { ensureStorageReady } from "./init";
import { listTeachingLoads, saveTeachingLoad } from "./repositories/teaching-loads";
import { syncSchoolClassToTeachingLoads } from "./sync-sf1";

function sampleClass(): SchoolClass {
  return {
    id: "cls-rizal",
    createdAt: Date.now(),
    source: "sf1.xlsx",
    schoolId: "300001",
    schoolName: "Demo NHS",
    region: "IV-A",
    division: "Laguna",
    district: "Calamba",
    schoolYear: "2026-2027",
    gradeLevel: "8",
    section: "Mabini",
    adviser: "Adviser",
    schoolHead: "Head",
    learners: [
      {
        lrn: "123456789012",
        lastName: "Santos",
        firstName: "Juan",
        middleName: "Dela",
        sex: "M",
        birthdate: "2012-05-01",
        age: "14",
        religion: "",
        motherTongue: "",
        modality: "In-Person",
        remarks: "",
      },
      {
        lrn: "123456789013",
        lastName: "Reyes",
        firstName: "Maria",
        middleName: "Cruz",
        sex: "F",
        birthdate: "2012-08-15",
        age: "13",
        religion: "",
        motherTongue: "",
        modality: "In-Person",
        remarks: "",
      },
    ],
  };
}

describe("syncSchoolClassToTeachingLoads", () => {
  it("creates an SF1 source load and applies the roster to matching subject loads", async () => {
    await ensureStorageReady();
    const math = createTeachingLoad({
      gradeLevel: "8",
      section: "Mabini",
      subject: "Science",
      schoolYear: "2026-2027",
    });
    await saveTeachingLoad(math);

    const result = await syncSchoolClassToTeachingLoads(sampleClass());
    expect(result.sourceLoad.subject).toBe("Class Roster (SF1)");
    expect(result.sourceLoad.learners).toHaveLength(2);
    expect(result.updatedLoads).toHaveLength(1);
    expect(result.updatedLoads[0].subject).toBe("Science");
    expect(result.updatedLoads[0].learners.map((item) => item.lastName)).toEqual(["Santos", "Reyes"]);

    const loads = await listTeachingLoads();
    const linkedMath = loads.find((item) => item.id === math.id);
    expect(linkedMath?.learners).toHaveLength(2);
    expect(linkedMath?.learners[0].avatarPresetId).toMatch(/^male-avatar-/);
  });
});
