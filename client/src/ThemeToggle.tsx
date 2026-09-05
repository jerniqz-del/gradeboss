import { Icon } from "./Icon";
import type { ThemePreference } from "./theme";

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: string;
}> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

export function ThemeToggle({
  preference,
  onChange,
  compact = false,
}: {
  preference: ThemePreference;
  onChange: (next: ThemePreference) => void;
  compact?: boolean;
}) {
  if (compact) {
    const next =
      preference === "light"
        ? "dark"
        : preference === "dark"
          ? "system"
          : "light";
    const icon =
      preference === "light"
        ? "sun"
        : preference === "dark"
          ? "moon"
          : "monitor";
    const label =
      preference === "light"
        ? "Light theme"
        : preference === "dark"
          ? "Dark theme"
          : "System theme";

    return (
      <button
        type="button"
        className="theme-toggle-compact"
        aria-label={`Appearance: ${label}. Click to change.`}
        title={label}
        onClick={() => onChange(next)}
      >
        <Icon name={icon} />
      </button>
    );
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Appearance">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={preference === opt.value ? "active" : undefined}
          aria-pressed={preference === opt.value}
          onClick={() => onChange(opt.value)}
        >
          <Icon name={opt.icon} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
