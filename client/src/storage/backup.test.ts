import { describe, expect, it } from "vitest";
import { listClasses } from "../classes";
import { createSampleTeachingLoad } from "./seed";
import { ensureStorageReady } from "./init";
import { listTeachingLoads, saveTeachingLoad } from "./repositories/teaching-loads";
import { exportBackupBundle, importBackupBundle, wipeGradeData } from "./backup";

describe("backup restore", () => {
  it("export → wipe → import replace restores loads and scores", async () => {
    await ensureStorageReady();
    const original = await listTeachingLoads();
    expect(original.length).toBeGreaterThan(0);
    const first = original[0];
    const exported = await exportBackupBundle();
    expect(exported.teachingLoads.map((row) => row.id)).toEqual(original.map((row) => row.id));

    await wipeGradeData();
    expect(await listTeachingLoads()).toEqual([]);
    expect(listClasses()).toEqual([]);

    const restored = await importBackupBundle(exported, "replace");
    const after = await listTeachingLoads();
    expect(after).toHaveLength(exported.teachingLoads.length);
    expect(after.find((row) => row.id === first.id)?.scores).toEqual(first.scores);
    expect(restored.teachingLoads[0]?.id).toBe(first.id);
  });

  it("merge keeps a local-only load and overwrites a matching id", async () => {
    await ensureStorageReady();
    const extra = { ...createSampleTeachingLoad(), id: "merge-local", subject: "Filipino" };
    await saveTeachingLoad(extra);
    const incoming = {
      ...(await exportBackupBundle()),
      teachingLoads: [{ ...createSampleTeachingLoad(), subject: "Science" }],
    };
    await importBackupBundle(incoming, "merge");
    const loads = await listTeachingLoads();
    expect(loads.some((row) => row.id === "merge-local")).toBe(true);
    expect(loads.find((row) => row.id === createSampleTeachingLoad().id)?.subject).toBe("Science");
  });
});
