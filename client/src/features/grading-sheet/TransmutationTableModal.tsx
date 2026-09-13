import { useEffect, useRef } from "react";
import type { TeachingLoad } from "../../models/teaching-load";
import type { TermGrade } from "../../domain/grading/types";
import {
  DO15_TRANSITION,
  DO8_2015,
  KEY_STAGE_2_TRIMESTER,
} from "../../domain/grading/transmutation";
import { determinePolicy, isKeyStage2Load, isZeroBasedSchoolYear } from "../../domain/policy";

type TableRow = { range: string; grade: TermGrade };

function numberLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function rowsForLoad(load: TeachingLoad): { title: string; rows: TableRow[] } {
  const detected = determinePolicy(load.gradeLevel, load.subject, load.schoolYear);
  const zeroBased = isZeroBasedSchoolYear(load.schoolYear) || detected === "DO15_ZERO";

  if (isKeyStage2Load(load) && !zeroBased) {
    return {
      title: "Key Stage 2 Trimester Transmutation Table",
      rows: KEY_STAGE_2_TRIMESTER.map(([minimum, grade], index) => ({
        range: `${numberLabel(minimum)} – ${numberLabel(index === 0 ? 100 : KEY_STAGE_2_TRIMESTER[index - 1][0] - 0.01)}`,
        grade,
      })),
    };
  }

  if (detected === "DO15_DESCRIPTIVE") {
    return {
      title: "Descriptive Transmutation Table",
      rows: [
        { range: "90 – 100", grade: "A" },
        { range: "80 – 89.99", grade: "B" },
        { range: "75 – 79.99", grade: "C" },
        { range: "65 – 74.99", grade: "D" },
        { range: "0 – 64.99", grade: "E" },
      ],
    };
  }

  if (zeroBased) {
    return {
      title: "Zero-Based Transmutation Table",
      rows: Array.from({ length: 101 }, (_, index) => {
        const grade = 100 - index;
        return {
          range: grade === 100 ? "99.50 – 100" : grade === 0 ? "0 – 0.49" : `${(grade - 0.5).toFixed(2)} – ${(grade + 0.49).toFixed(2)}`,
          grade,
        };
      }),
    };
  }

  const source = load.policy === "DO8_2015" ? DO8_2015 : DO15_TRANSITION;
  return {
    title: load.policy === "DO8_2015" ? "DO 8, s. 2015 Transmutation Table" : "DO 15, s. 2026 Transmutation Table",
    rows: source.map(([minimum, maximum, grade]) => ({
      range: `${numberLabel(minimum)} – ${numberLabel(maximum)}`,
      grade,
    })),
  };
}

export function TransmutationTableModal({
  load,
  learnerName,
  initialGrade,
  transmutedGrade,
  onClose,
}: {
  load: TeachingLoad;
  learnerName: string;
  initialGrade: number;
  transmutedGrade: TermGrade;
  onClose: () => void;
}) {
  const table = rowsForLoad(load);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="att-modal-backdrop" onClick={onClose}>
      <div
        className="card att-modal transmutation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transmutation-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <div className="att-modal-head">
          <div>
            <h3 id="transmutation-title">{table.title}</h3>
            <p className="muted small">{learnerName} · IG {numberLabel(initialGrade)} · TG {String(transmutedGrade)}</p>
          </div>
          <button type="button" className="ghost destructive-action" autoFocus onClick={onClose}>Close</button>
        </div>
        <div className="transmutation-table-wrap">
          <table className="transmutation-table">
            <thead><tr><th scope="col">Initial Grade Range</th><th scope="col">Transmuted Grade</th></tr></thead>
            <tbody>
              {table.rows.map((row) => {
                const selected = String(row.grade) === String(transmutedGrade);
                return <tr ref={selected ? selectedRowRef : undefined} className={selected ? "is-selected" : undefined} key={row.range + String(row.grade)}>
                  <td>{row.range}</td>
                  <td><strong>{String(row.grade)}</strong>{selected ? <span className="sr-only"> Selected learner grade</span> : null}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}