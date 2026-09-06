import { describe, expect, it } from "vitest";
import { createDefaultProfile } from "../../models/teacher-profile";
import { createSampleTeachingLoad } from "../../storage/seed";
import { buildBackupBundle, mergeBackupBundles, parseBackupBundle } from "./backup";
import { BACKUP_FORMAT } from "./types";

describe("parseBackupBundle", () => {
  it("rejects unknown files", () => {
    expect(() => parseBackupBundle({ hello: true })).toThrow(/not a GradeBoss backup/);
    expect(() => parseBackupBundle(null)).toThrow(/not a GradeBoss backup/);
  });

  it("rejects a wrong version", () => {
    expect(() => parseBackupBundle({ format: BACKUP_FORMAT, version: 99, teachingLoads: [] })).toThrow(/Unsupported/);
  });

  it("accepts a valid bundle and fills defaults", () => {
    const load = createSampleTeachingLoad();
    const parsed = parseBackupBundle({
      format: BACKUP_FORMAT,
      version: 1,
      teachingLoads: [load],
    });
    expect(parsed.teachingLoads).toHaveLength(1);
    expect(parsed.legacy.students).toEqual([]);
    expect(parsed.profile.schoolYear).toBeTruthy();
  });
});

describe("mergeBackupBundles", () => {
  it("lets incoming loads win on the same id and keeps local-only loads", () => {
    const localLoad = createSampleTeachingLoad();
    const incoming = { ...localLoad, subject: "Science" };
    const extra = { ...createSampleTeachingLoad(), id: "local-only" };
    const local = buildBackupBundle({
      profile: createDefaultProfile(),
      teachingLoads: [localLoad, extra],
    });
    const remote = buildBackupBundle({
      profile: { ...createDefaultProfile(), teacherName: "Imported" },
      teachingLoads: [incoming],
    });
    const merged = mergeBackupBundles(local, remote);
    expect(merged.teachingLoads).toHaveLength(2);
    expect(merged.teachingLoads.find((row) => row.id === localLoad.id)?.subject).toBe("Science");
    expect(merged.teachingLoads.some((row) => row.id === "local-only")).toBe(true);
    expect(merged.profile.teacherName).toBe("Imported");
  });
});
