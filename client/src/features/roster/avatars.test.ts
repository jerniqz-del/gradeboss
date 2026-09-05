import { describe, expect, it } from "vitest";
import { createLearner } from "./learner";
import { assignRoster, avatarSvg, FEMALE_IDS, isValidAvatarId, MALE_IDS, NEUTRAL_ID, setManualPreset } from "./avatars";

describe("learner avatars", () => {
  it("exposes 50 male + 50 female + 1 neutral presets", () => {
    expect(MALE_IDS).toHaveLength(50);
    expect(FEMALE_IDS).toHaveLength(50);
    expect(isValidAvatarId(NEUTRAL_ID)).toBe(true);
    expect(isValidAvatarId("male-avatar-001")).toBe(true);
    expect(isValidAvatarId("nope")).toBe(false);
  });

  it("auto-assigns sex-matched presets and keeps LRN consistency", () => {
    const a = createLearner({ lrn: "123456789012", lastName: "Santos", firstName: "Juan", sex: "M" });
    const b = createLearner({ lrn: "123456789013", lastName: "Reyes", firstName: "Maria", sex: "F" }, [a]);
    const roster = assignRoster([a, b]);
    expect(roster[0].avatarPresetId).toMatch(/^male-avatar-/);
    expect(roster[1].avatarPresetId).toMatch(/^female-avatar-/);
    const again = assignRoster(
      [
        { ...a, avatarPresetId: undefined, avatarAssignment: "auto" },
        { ...b, avatarPresetId: undefined, avatarAssignment: "auto" },
      ],
      new Map([["123456789012", roster[0].avatarPresetId!]]),
    );
    expect(again[0].avatarPresetId).toBe(roster[0].avatarPresetId);
  });

  it("honors a manual preset and renders SVG locally", () => {
    const learner = setManualPreset(
      createLearner({ lastName: "Santos", firstName: "Juan", sex: "M" }),
      "male-avatar-007",
    );
    expect(learner.avatarAssignment).toBe("manual");
    expect(avatarSvg(learner.avatarPresetId!)).toContain("<svg");
    expect(avatarSvg(learner.avatarPresetId!)).toContain("viewBox");
  });
});
