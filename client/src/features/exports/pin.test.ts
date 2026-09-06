import { describe, expect, it } from "vitest";
import { createSampleTeachingLoad } from "../../storage/seed";
import { buildBackupBundle } from "./backup";
import { isSealedBackup, sealBackup, unsealBackup } from "./pin";

describe("PIN wrap", () => {
  const bundle = buildBackupBundle({ teachingLoads: [createSampleTeachingLoad()] });

  it("round-trips a sealed backup with the correct PIN", async () => {
    const sealed = await sealBackup(bundle, "2468");
    expect(isSealedBackup(sealed)).toBe(true);
    const opened = await unsealBackup(sealed, "2468");
    expect(opened.teachingLoads[0]?.id).toBe(bundle.teachingLoads[0].id);
    expect(opened.teachingLoads[0]?.scores).toEqual(bundle.teachingLoads[0].scores);
  });

  it("rejects a wrong PIN", async () => {
    const sealed = await sealBackup(bundle, "2468");
    await expect(unsealBackup(sealed, "0000")).rejects.toThrow(/Wrong PIN/);
  });
});
