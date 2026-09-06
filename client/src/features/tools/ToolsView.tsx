import { useState } from "react";
import { Icon } from "../../Icon";
import { HelpDialog } from "../shell/HelpDialog";
import type { AppView } from "../shell/AppSidebar";

const TOOLS: Array<{
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  used: number;
  view?: AppView;
}> = [
  {
    id: "name-picker",
    title: "Name Picker",
    description: "Pick learners fairly with animated classroom experiences and term stars.",
    icon: "sync",
    tone: "red",
    used: 0,
  },
  {
    id: "groups",
    title: "Group Randomizer",
    description: "Build random or sex-balanced teams with presentation-ready reveals.",
    icon: "users3",
    tone: "blue",
    used: 0,
  },
  {
    id: "simulator",
    title: "Grade Simulator",
    description: "Try score changes safely before applying them to the class record.",
    icon: "beaker",
    tone: "purple",
    used: 0,
    view: "sheet",
  },
  {
    id: "games",
    title: "Games",
    description: "Open fun offline games for breaks, rewards, and learning stations.",
    icon: "gamepad",
    tone: "orange",
    used: 0,
  },
  {
    id: "timer",
    title: "Activity Timer",
    description: "Run lesson segments, transitions, and classroom activity countdowns.",
    icon: "clock",
    tone: "teal",
    used: 0,
  },
  {
    id: "participation",
    title: "Participation Tracker",
    description: "Award and undo the same class- and term-scoped stars used by Name Picker.",
    icon: "star",
    tone: "gold",
    used: 0,
    view: "checklist",
  },
  {
    id: "noise",
    title: "Noise Meter",
    description: "Monitor live room volume locally without recording classroom audio.",
    icon: "waves",
    tone: "green",
    used: 0,
  },
  {
    id: "duels",
    title: "Class Duels",
    description: "Run learner-versus-learner or team classroom challenges.",
    icon: "swords",
    tone: "red",
    used: 0,
  },
  {
    id: "seating",
    title: "Seating Chart",
    description: "Arrange, lock, print, and randomize classroom seats.",
    icon: "grid",
    tone: "indigo",
    used: 0,
  },
  {
    id: "exit",
    title: "Exit Ticket",
    description: "Record quick learner understanding and follow-up needs.",
    icon: "inbox",
    tone: "teal",
    used: 0,
  },
  {
    id: "notes",
    title: "Anecdotal Notes",
    description: "Keep private, class-scoped anecdotal observations.",
    icon: "note",
    tone: "purple",
    used: 0,
  },
  {
    id: "boats",
    title: "Boat Race",
    description: "Use Randomizer teams in a lively teacher-scored boat race.",
    icon: "sail",
    tone: "blue",
    used: 0,
  },
];

export function ToolsView({
  onNavigate,
}: {
  onNavigate: (view: AppView) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [motion, setMotion] = useState("playful");
  const picked = TOOLS.find((tool) => tool.id === selected);

  return (
    <section className="tools-page">
      <div className="tools-hero">
        <div>
          <h2>Choose a classroom tool</h2>
          <p>Everything you need for fair participation, classroom routines, records, and learner-friendly activities.</p>
        </div>
        <div className="tools-hero-meta">
          <strong>{TOOLS.length} tools</strong>
          <label>
            Motion
            <select value={motion} onChange={(event) => setMotion(event.target.value)}>
              <option value="playful">Playful</option>
              <option value="calm">Calm</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
      </div>

      <div className="tools-grid">
        {TOOLS.map((tool) => (
          <button
            type="button"
            key={tool.id}
            className={`tools-card tools-card--${tool.tone} ${selected === tool.id ? "is-selected" : ""}`}
            onClick={() => {
              if (tool.view) onNavigate(tool.view);
              else setSelected(tool.id);
            }}
          >
            <span className="tools-card-icon" aria-hidden="true">
              <Icon name={tool.icon} />
            </span>
            <span className="tools-card-copy">
              <strong>{tool.title}</strong>
              <span>{tool.description}</span>
            </span>
            <span className="tools-card-used">Used {tool.used} time{tool.used === 1 ? "" : "s"}</span>
          </button>
        ))}
      </div>

      {picked && !picked.view ? (
        <HelpDialog title={picked.title} onClose={() => setSelected(null)}>
          <p>{picked.description}</p>
          <p className="muted">
            This classroom tool is listed so the suite matches E-Class Record. The live activity will open here once
            that Phase 11 module is ported. Grade Simulator and Participation Tracker already jump to the grading sheet
            and performance checklist.
          </p>
        </HelpDialog>
      ) : null}
    </section>
  );
}
