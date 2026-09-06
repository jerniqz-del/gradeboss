import type { ReactNode } from "react";

export function HelpDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="ecr-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="ecr-dialog" role="dialog" aria-labelledby="ecr-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="ecr-dialog-head">
          <h3 id="ecr-dialog-title">{title}</h3>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ecr-dialog-body">{children}</div>
      </div>
    </div>
  );
}
