import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function FitSheet({ minimumWidth, children }: { minimumWidth: number; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => setAvailableWidth(Math.max(0, element.clientWidth - 1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(minimumWidth, availableWidth);
  const scale = availableWidth > 0 ? Math.min(1, availableWidth / width) : 1;
  return <div ref={container} className="table-scroll sheet-scroll sheet-fit" style={{
    "--sheet-fit-width": width + "px",
    "--sheet-fit-scale": scale,
  } as CSSProperties}>{children}</div>;
}
