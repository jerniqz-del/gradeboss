import type { Learner } from "../../models/learner";
import type { Sex } from "../../models/types";
import { normalizeSex } from "./normalize";

/**
 * Procedural learner avatars — port of eclassrecord `learner-avatars.js`.
 * 50 male + 50 female + 1 neutral. Profiles store only a preset ID;
 * SVG is rendered locally so the PWA needs no extra image assets.
 */

export const NEUTRAL_ID = "learner-avatar-neutral";

export const MALE_IDS = Object.freeze(
  Array.from({ length: 50 }, (_, index) => `male-avatar-${String(index + 1).padStart(3, "0")}`),
);

export const FEMALE_IDS = Object.freeze(
  Array.from({ length: 50 }, (_, index) => `female-avatar-${String(index + 1).padStart(3, "0")}`),
);

const VALID_IDS = new Set<string>([NEUTRAL_ID, ...MALE_IDS, ...FEMALE_IDS]);

const SKIN_TONES = [
  "#f6d2b8",
  "#edc3a5",
  "#dfa982",
  "#cf9167",
  "#ba7954",
  "#a96644",
  "#8d5035",
  "#743e2b",
  "#5d3024",
  "#45241d",
];
const HAIR_COLORS = ["#211915", "#3b281d", "#5a3825", "#744b2b", "#1f2937"];
const SHIRT_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#4d7c0f",
  "#c2410c",
  "#4f46e5",
  "#0f766e",
];
const BACKGROUNDS = [
  "#dbeafe",
  "#d1fae5",
  "#fef3c7",
  "#ffe4e6",
  "#ede9fe",
  "#cffafe",
  "#ecfccb",
  "#ffedd5",
  "#e0e7ff",
  "#ccfbf1",
];

export function isValidAvatarId(value: unknown): boolean {
  return VALID_IDS.has(String(value || ""));
}

export function categoryForId(value: unknown): Sex {
  const id = String(value || "");
  if ((MALE_IDS as readonly string[]).includes(id)) return "M";
  if ((FEMALE_IDS as readonly string[]).includes(id)) return "F";
  return "";
}

export function presetsForSex(sex: unknown): readonly string[] {
  const category = normalizeSex(sex);
  if (category === "M") return MALE_IDS;
  if (category === "F") return FEMALE_IDS;
  return [NEUTRAL_ID];
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableLearnerKey(learner: Pick<Learner, "id" | "lrn" | "lastName" | "firstName">): string {
  const lrn = String(learner.lrn || "").replace(/\D/g, "");
  return lrn.length === 12
    ? `lrn:${lrn}`
    : `id:${String(learner.id || "")}|${String(learner.lastName || "")}|${String(learner.firstName || "")}`;
}

function matchingPool(sex: unknown): readonly string[] {
  const category = normalizeSex(sex);
  if (category === "M") return MALE_IDS;
  if (category === "F") return FEMALE_IDS;
  return [];
}

function chooseAvailablePreset(
  learner: Learner,
  used: Set<string>,
  preferredId = "",
): string {
  const pool = matchingPool(learner.sex);
  if (!pool.length) return NEUTRAL_ID;
  if (pool.includes(preferredId) && !used.has(preferredId)) return preferredId;
  const start = hashText(stableLearnerKey(learner)) % pool.length;
  for (let offset = 0; offset < pool.length; offset++) {
    const candidate = pool[(start + offset) % pool.length];
    if (!used.has(candidate)) return candidate;
  }
  return pool[start];
}

/** Immutable port of eclassrecord `assignRoster`. */
export function assignRoster(learners: Learner[], knownByLrn = new Map<string, string>()): Learner[] {
  const roster = learners.filter(Boolean);
  const used = new Set<string>();
  const automatic: Learner[] = [];
  const next = roster.map((learner) => ({ ...learner }));

  for (const learner of next) {
    const category = categoryForId(learner.avatarPresetId);
    const manual = learner.avatarAssignment === "manual";
    if (manual && isValidAvatarId(learner.avatarPresetId)) {
      if (category) used.add(learner.avatarPresetId!);
      continue;
    }
    automatic.push(learner);
  }

  automatic
    .slice()
    .sort((left, right) => stableLearnerKey(left).localeCompare(stableLearnerKey(right)))
    .forEach((learner) => {
      const sex = normalizeSex(learner.sex);
      const lrn = String(learner.lrn || "").replace(/\D/g, "");
      const known = lrn.length === 12 ? knownByLrn.get(lrn) : "";
      const current = categoryForId(learner.avatarPresetId) === sex ? learner.avatarPresetId : "";
      const preferred = [known, current].find((id) => id && categoryForId(id) === sex) || "";
      const selected = chooseAvailablePreset(learner, used, preferred);
      learner.avatarPresetId = selected;
      learner.avatarAssignment = "auto";
      if (selected !== NEUTRAL_ID) used.add(selected);
      if (lrn.length === 12 && selected !== NEUTRAL_ID && !knownByLrn.has(lrn)) {
        knownByLrn.set(lrn, selected);
      }
    });

  return next;
}

export function assignNewLearner(learner: Learner, roster: Learner[] = []): Learner {
  const next = { ...learner, avatarAssignment: "auto" as const };
  const category = normalizeSex(next.sex);
  if (!category) {
    next.avatarPresetId = NEUTRAL_ID;
    return next;
  }
  const used = new Set(
    roster
      .filter((item) => item.id !== next.id && categoryForId(item.avatarPresetId) === category)
      .map((item) => item.avatarPresetId)
      .filter((id): id is string => Boolean(id)),
  );
  next.avatarPresetId = chooseAvailablePreset(next, used);
  return next;
}

export function setManualPreset(learner: Learner, presetId: string): Learner {
  if (!isValidAvatarId(presetId)) throw new Error("Choose a valid learner avatar.");
  return { ...learner, avatarPresetId: presetId, avatarAssignment: "manual" };
}

function maleHair(style: number, color: string): string {
  const styles = [
    `<path d="M18 26c0-11 6-17 14-17s14 6 14 17c-5-5-10-7-15-7-4 0-8 2-13 7Z" fill="${color}"/>`,
    `<path d="M18 25C19 13 25 8 34 9c7 1 11 6 12 15-7-4-13-6-20-3-3 1-5 3-8 4Z" fill="${color}"/><path d="M20 17c8 3 15 2 23-2" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`,
    `<g fill="${color}"><circle cx="21" cy="19" r="5"/><circle cx="28" cy="14" r="6"/><circle cx="36" cy="14" r="6"/><circle cx="43" cy="19" r="5"/></g>`,
    `<path d="M19 23V13c8-5 18-5 26 0v10c-7-4-18-4-26 0Z" fill="${color}"/>`,
    `<path d="M18 26c1-10 4-15 10-17l3 8 4-9 4 9 5-5c2 4 3 8 2 14-8-6-20-7-28 0Z" fill="${color}"/>`,
  ];
  return styles[style % styles.length];
}

function femaleBackHair(style: number, color: string): string {
  const styles = [
    `<path d="M15 27C15 8 49 8 49 27v24H15V27Z" fill="${color}"/>`,
    `<path d="M16 28C16 9 48 9 48 28v14c-7 8-25 8-32 0V28Z" fill="${color}"/>`,
    `<circle cx="50" cy="25" r="9" fill="${color}"/><path d="M17 28C17 10 47 10 47 28v20H17V28Z" fill="${color}"/>`,
    `<path d="M17 27C17 9 47 9 47 27v16H17V27Z" fill="${color}"/><path d="M18 36c-8 8-6 18 0 23M46 36c8 8 6 18 0 23" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`,
    `<circle cx="32" cy="9" r="9" fill="${color}"/><path d="M16 28C16 10 48 10 48 28v19H16V28Z" fill="${color}"/>`,
  ];
  return styles[style % styles.length];
}

function femaleFrontHair(style: number, color: string): string {
  const styles = [
    `<path d="M18 26C18 13 25 10 32 10c8 0 14 5 14 16-7-6-16-8-28 0Z" fill="${color}"/>`,
    `<path d="M17 26c1-12 7-17 15-17 9 0 14 6 15 17-8-6-19-7-30 0Z" fill="${color}"/>`,
    `<path d="M18 25c1-11 6-16 14-16 9 0 14 6 14 17-5-4-9-6-14-6s-9 2-14 5Z" fill="${color}"/>`,
    `<path d="M18 26C18 14 24 9 32 9s14 5 14 17c-6-5-12-7-18-5-4 1-7 3-10 5Z" fill="${color}"/>`,
    `<path d="M18 26c0-12 6-17 14-17 9 0 14 6 14 17-7-5-12-6-16-4-4 1-8 2-12 4Z" fill="${color}"/>`,
  ];
  return styles[style % styles.length];
}

/** SVG markup for a preset — eclassrecord `avatarSvg`. */
export function avatarSvg(presetId: string): string {
  const id = isValidAvatarId(presetId) ? presetId : NEUTRAL_ID;
  const category = categoryForId(id);
  if (!category) {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#e2e8f0"/><circle cx="32" cy="24" r="12" fill="#94a3b8"/><path d="M10 62c2-16 10-24 22-24s20 8 22 24H10Z" fill="#64748b"/></svg>`;
  }
  const number = Number(id.slice(-3)) - 1;
  const skin = SKIN_TONES[number % SKIN_TONES.length];
  const hair = HAIR_COLORS[(number * 3 + (category === "F" ? 1 : 0)) % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[(number * 7 + (category === "F" ? 3 : 0)) % SHIRT_COLORS.length];
  const background = BACKGROUNDS[(number * 7 + (category === "F" ? 5 : 0)) % BACKGROUNDS.length];
  const style = Math.floor(number / 10) % 5;
  const glasses = number % 4 === 0;
  const freckles = number % 7 === 0;
  const backHair = category === "F" ? femaleBackHair(style, hair) : "";
  const frontHair = category === "F" ? femaleFrontHair(style, hair) : maleHair(style, hair);
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="${background}"/>
      ${backHair}
      <path d="M9 64c2-14 10-22 23-22s21 8 23 22H9Z" fill="${shirt}"/>
      <path d="M27 38h10v9H27z" fill="${skin}"/>
      <circle cx="18" cy="29" r="4" fill="${skin}"/><circle cx="46" cy="29" r="4" fill="${skin}"/>
      <circle cx="32" cy="27" r="15" fill="${skin}"/>
      ${frontHair}
      <circle cx="27" cy="28" r="1.4" fill="#302521"/><circle cx="37" cy="28" r="1.4" fill="#302521"/>
      ${glasses ? '<g fill="none" stroke="#334155" stroke-width="1.5"><rect x="22" y="24" width="9" height="7" rx="3"/><rect x="33" y="24" width="9" height="7" rx="3"/><path d="M31 27h2"/></g>' : ""}
      ${freckles ? '<g fill="#9a6049" opacity=".65"><circle cx="24" cy="32" r=".7"/><circle cx="27" cy="33" r=".7"/><circle cx="40" cy="32" r=".7"/><circle cx="37" cy="33" r=".7"/></g>' : ""}
      <path d="M27 35c3 3 7 3 10 0" fill="none" stroke="#9f4f4f" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M20 64c1-8 5-14 12-17 7 3 11 9 12 17" fill="#fff" fill-opacity=".18"/>
    </svg>`;
}

export function avatarLabel(presetId: string): string {
  const category = categoryForId(presetId);
  if (category === "M") return "Male learner avatar";
  if (category === "F") return "Female learner avatar";
  return "Default learner avatar";
}
