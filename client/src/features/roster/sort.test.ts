import { describe, expect, it } from "vitest";
import type { Learner } from "../../models/learner";
import { sortDepEdRoster } from "./sort";

function learner(partial: Partial<Learner> & Pick<Learner, "lastName" | "firstName" | "sex">): Learner {
  return {
    id: partial.id || crypto.randomUUID(),
    lrn: partial.lrn || "",
    middleName: partial.middleName || "",
    birthdate: "",
    ...partial,
  };
}

describe("sortDepEdRoster", () => {
  it("places males before females, then sorts Filipino alpha within each block", () => {
    const roster = [
      learner({ lastName: "Reyes", firstName: "Maria", sex: "F" }),
      learner({ lastName: "Ñigo", firstName: "Carlo", sex: "M" }),
      learner({ lastName: "Santos", firstName: "Juan", sex: "M" }),
      learner({ lastName: "Garcia", firstName: "Ana", sex: "F" }),
      learner({ lastName: "Unknown", firstName: "Pat", sex: "" }),
    ];
    const sorted = sortDepEdRoster(roster);
    expect(sorted.map((item) => `${item.sex}:${item.lastName}`)).toEqual([
      "M:Ñigo",
      "M:Santos",
      "F:Garcia",
      "F:Reyes",
      ":Unknown",
    ]);
  });
});
