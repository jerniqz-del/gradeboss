import type { ReactNode } from "react";
import type { TeachingLoad } from "../../models/teaching-load";
import { classOptionLabel } from "./labels";

export function ActiveClassBar({
  loads,
  selectedId,
  onSelect,
  label = "Active Class",
  children,
}: {
  loads: TeachingLoad[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ecr-active-bar">
      <label className="ecr-active-label">
        {label}
        <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
          {loads.length === 0 ? <option value="">No classes yet</option> : null}
          {loads.map((load) => (
            <option key={load.id} value={load.id}>
              {classOptionLabel(load)}
            </option>
          ))}
        </select>
      </label>
      {children ? <div className="ecr-active-actions">{children}</div> : null}
    </div>
  );
}
