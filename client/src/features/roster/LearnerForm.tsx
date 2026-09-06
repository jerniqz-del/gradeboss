import { useState } from "react";
import type { Learner } from "../../models/learner";
import type { Sex } from "../../models/types";
import { AvatarPicker } from "./AvatarPicker";
import { LearnerAvatar } from "./LearnerAvatar";
import { assignNewLearner, NEUTRAL_ID } from "./avatars";
import { createLearner, updateLearner, validateLearnerForm, type LearnerFormValues } from "./learner";

const emptyForm: LearnerFormValues = {
  lrn: "",
  lastName: "",
  firstName: "",
  middleName: "",
  extensionName: "",
  sex: "",
  birthdate: "",
  modality: "",
  remarks: "",
};

function fromLearner(learner: Learner): LearnerFormValues {
  return {
    lrn: learner.lrn,
    lastName: learner.lastName,
    firstName: learner.firstName,
    middleName: learner.middleName,
    extensionName: learner.extensionName || "",
    sex: learner.sex,
    birthdate: learner.birthdate,
    age: learner.age || "",
    religion: learner.religion || "",
    motherTongue: learner.motherTongue || "",
    modality: learner.modality || "",
    remarks: learner.remarks || "",
    avatarPresetId: learner.avatarPresetId,
    avatarAssignment: learner.avatarAssignment,
  };
}

export function LearnerForm({
  learner,
  roster,
  onCancel,
  onSave,
}: {
  learner?: Learner | null;
  roster: Learner[];
  onCancel: () => void;
  onSave: (learner: Learner) => void;
}) {
  const [values, setValues] = useState<LearnerFormValues>(learner ? fromLearner(learner) : emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [showAvatars, setShowAvatars] = useState(false);

  const set = (field: keyof LearnerFormValues, value: string) => {
    setValues((current) => {
      const next = { ...current, [field]: value };
      if (field === "sex" && current.avatarAssignment !== "manual") {
        const preview = assignNewLearner(
          {
            id: learner?.id || "preview",
            lrn: next.lrn || "",
            lastName: next.lastName || "",
            firstName: next.firstName || "",
            middleName: next.middleName || "",
            sex: value as Sex,
            birthdate: next.birthdate || "",
          },
          roster,
        );
        next.avatarPresetId = preview.avatarPresetId;
        next.avatarAssignment = "auto";
      }
      return next;
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problems = validateLearnerForm(values);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    const saved = learner ? updateLearner(learner, values, roster) : createLearner(values, roster);
    onSave(saved);
  };

  return (
    <form className="learner-form" onSubmit={submit}>
      <div className="learner-form-head">
        <button
          type="button"
          className="avatar-open"
          onClick={() => setShowAvatars((open) => !open)}
          aria-expanded={showAvatars}
          aria-label="Choose learner avatar"
        >
          <LearnerAvatar presetId={values.avatarPresetId || NEUTRAL_ID} size="lg" decorative={false} />
          <span>Avatar</span>
        </button>
        <div>
          <h3>{learner ? "Edit learner" : "Add learner"}</h3>
          <p className="muted">LRN, name, and sex follow DepEd SF1 fields.</p>
        </div>
      </div>

      {showAvatars && (
        <AvatarPicker
          sex={values.sex || ""}
          value={values.avatarPresetId}
          onChange={(id) => {
            setValues((current) => ({ ...current, avatarPresetId: id, avatarAssignment: "manual" }));
            setShowAvatars(false);
          }}
        />
      )}

      {errors.length > 0 && (
        <div className="banner error">
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}

      <div className="form-grid">
        <label>
          LRN
          <input
            inputMode="numeric"
            maxLength={12}
            placeholder="12 digits"
            value={values.lrn || ""}
            onChange={(e) => set("lrn", e.target.value)}
          />
        </label>
        <label>
          Last name
          <input
            required
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </label>
        <label>
          First name
          <input
            required
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </label>
        <label>
          Middle name
          <input value={values.middleName || ""} onChange={(e) => set("middleName", e.target.value)} />
        </label>
        <label>
          Extension
          <input
            placeholder="Jr., III"
            value={values.extensionName || ""}
            onChange={(e) => set("extensionName", e.target.value)}
          />
        </label>
        <label>
          Sex
          <select value={values.sex || ""} onChange={(e) => set("sex", e.target.value)}>
            <option value="">Unknown</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </label>
        <label>
          Birthdate
          <input
            type="date"
            value={values.birthdate || ""}
            onChange={(e) => set("birthdate", e.target.value)}
          />
        </label>
        <label>
          Modality
          <input
            placeholder="In-Person / Modular"
            value={values.modality || ""}
            onChange={(e) => set("modality", e.target.value)}
          />
        </label>
        <label className="span-all">
          Remarks
          <input value={values.remarks || ""} onChange={(e) => set("remarks", e.target.value)} />
        </label>
      </div>

      <div className="form-row wrap">
        <button type="submit" className="primary">
          {learner ? "Save learner" : "Add to roster"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
