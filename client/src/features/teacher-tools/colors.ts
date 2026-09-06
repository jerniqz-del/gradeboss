export const GROUP_COLOR_SCHEMES = [
  { name: "Blue", accent: "#2563eb" },
  { name: "Emerald", accent: "#059669" },
  { name: "Amber", accent: "#d97706" },
  { name: "Rose", accent: "#e11d48" },
  { name: "Violet", accent: "#7c3aed" },
  { name: "Cyan", accent: "#0891b2" },
  { name: "Lime", accent: "#4d7c0f" },
  { name: "Orange", accent: "#c2410c" },
  { name: "Indigo", accent: "#4f46e5" },
  { name: "Teal", accent: "#0f766e" },
  { name: "Pink", accent: "#be185d" },
  { name: "Red", accent: "#b91c1c" },
  { name: "Sky", accent: "#0369a1" },
  { name: "Green", accent: "#15803d" },
  { name: "Gold", accent: "#a16207" },
  { name: "Fuchsia", accent: "#a21caf" },
  { name: "Purple", accent: "#6d28d9" },
  { name: "Turquoise", accent: "#0e7490" },
  { name: "Olive", accent: "#3f6212" },
  { name: "Coral", accent: "#c2415d" },
] as const;

export type GroupColor = (typeof GROUP_COLOR_SCHEMES)[number];
