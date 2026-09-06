import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { Icon } from "../../Icon";
import type { TeachingLoad } from "../../models/teaching-load";
import { policyLabel } from "../teaching-loads/create-load";
import { AnalysisPanel } from "./AnalysisPanel";
import { NamePickerPanel } from "./NamePickerPanel";
import { RandomizerPanel } from "./RandomizerPanel";
import { SimulatorPanel } from "./SimulatorPanel";

type ToolId = "home" | "groups" | "picker" | "simulator" | "analysis";

const TOOLS: Array<{ id: Exclude<ToolId, "home">; title: string; blurb: string; icon: string }> = [
  { id: "groups", title: "Group randomizer", blurb: "Sex-balanced or fully random groups. Print or copy the lists.", icon: "shuffle" },
  { id: "picker", title: "Name picker", blurb: "Fair no-repeat draws with avatars. Resets when everyone has been picked.", icon: "users" },
  { id: "simulator", title: "Grade simulator", blurb: "What-if scores with live term grades. Apply or revert on the official record.", icon: "pencil" },
  { id: "analysis", title: "Class analysis", blurb: "MPS, distribution, ranking, and pass rate for a term or the year.", icon: "chart" },
];

export function TeacherToolsView({
  selectedLoadId,
  onSelectLoad,
}: {
  selectedLoadId: string | null;
  onSelectLoad: (id: string) => void;
}) {
  const [loads, setLoads] = useState<TeachingLoad[]>([]);
  const [load, setLoad] = useState<TeachingLoad | null>(null);
  const [tool, setTool] = useState<ToolId>("home");
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    const next = await api.getTeachingLoads();
    setLoads(next);
    return next;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await refreshList();
        const id = selectedLoadId || list[0]?.id;
        if (id && id !== selectedLoadId) onSelectLoad(id);
        if (id) {
          const found = list.find((item) => item.id === id) || (await api.getTeachingLoad(id));
          setLoad(found ?? null);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open teacher tools");
      }
    })();
  }, [onSelectLoad, refreshList, selectedLoadId]);

  if (loads.length === 0) {
    return (
      <section>
        <div className="page-header">
          <h2>Teacher tools</h2>
          <p>Create a teaching load with a roster first, then randomize groups, pick names, or simulate grades.</p>
        </div>
      </section>
    );
  }

  const active = TOOLS.find((item) => item.id === tool);

  return (
    <section className="tools-page">
      <div className="page-header">
        <h2>{active ? active.title : "Teacher tools"}</h2>
        <p>{active ? active.blurb : "Classroom utilities from E-Class Record. Works offline."}</p>
      </div>
      {error && <div className="banner error">{error}</div>}
      <div className="sheet-toolbar">
        <label>
          Teaching load
          <select value={load?.id || ""} onChange={(event) => onSelectLoad(event.target.value)}>
            {loads.map((item) => (
              <option key={item.id} value={item.id}>
                G{item.gradeLevel} {item.section} — {item.subject}
              </option>
            ))}
          </select>
        </label>
        {load && (
          <div className="form-preview">
            <span className="pill">{policyLabel(load.policy)}</span>
            <span className="pill">{load.learners.length} learners</span>
          </div>
        )}
      </div>
      {tool !== "home" && (
        <div className="tools-actions no-print">
          <button type="button" className="ghost" onClick={() => setTool("home")}>
            Back to tools
          </button>
        </div>
      )}
      {tool === "home" && (
        <div className="tools-grid">
          {TOOLS.map((item) => (
            <button key={item.id} type="button" className="tools-card" onClick={() => setTool(item.id)}>
              <Icon name={item.icon} />
              <strong>{item.title}</strong>
              <span className="muted">{item.blurb}</span>
            </button>
          ))}
        </div>
      )}
      {load && tool === "groups" && <RandomizerPanel load={load} />}
      {load && tool === "picker" && <NamePickerPanel load={load} />}
      {load && tool === "simulator" && (
        <SimulatorPanel
          load={load}
          onLoadChange={(next) => {
            setLoad(next);
            setLoads((current) => current.map((item) => (item.id === next.id ? next : item)));
          }}
        />
      )}
      {load && tool === "analysis" && <AnalysisPanel load={load} />}
    </section>
  );
}
