import type { Sex } from "../../models/types";
import { LearnerAvatar } from "./LearnerAvatar";
import { FEMALE_IDS, MALE_IDS, NEUTRAL_ID, presetsForSex } from "./avatars";

export function AvatarPicker({
  sex,
  value,
  onChange,
}: {
  sex: Sex | string;
  value?: string;
  onChange: (presetId: string) => void;
}) {
  const preferred = presetsForSex(sex);
  const extras =
    sex === "M" ? [NEUTRAL_ID, ...FEMALE_IDS] : sex === "F" ? [NEUTRAL_ID, ...MALE_IDS] : [...MALE_IDS, ...FEMALE_IDS];
  const ids = [...preferred, ...extras.filter((id) => !preferred.includes(id))];

  return (
    <div className="avatar-picker" role="listbox" aria-label="Learner avatar">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          role="option"
          aria-selected={value === id}
          className={value === id ? "avatar-choice selected" : "avatar-choice"}
          onClick={() => onChange(id)}
        >
          <LearnerAvatar presetId={id} size="md" decorative={false} />
        </button>
      ))}
    </div>
  );
}
