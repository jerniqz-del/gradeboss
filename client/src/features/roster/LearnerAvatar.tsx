import { avatarLabel, avatarSvg, NEUTRAL_ID } from "./avatars";

export function LearnerAvatar({
  presetId,
  size = "sm",
  decorative = true,
}: {
  presetId?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  decorative?: boolean;
}) {
  const id = presetId || NEUTRAL_ID;
  return (
    <span
      className={`learner-avatar learner-avatar--${size}`}
      data-avatar-id={id}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": avatarLabel(id) })}
      dangerouslySetInnerHTML={{ __html: avatarSvg(id) }}
    />
  );
}
