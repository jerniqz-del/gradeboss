import { useState } from "react";
import { learnerDisplayName } from "../../models/learner";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { printGroupLists } from "../exports/print";
import {
  formatGroupsPlainText,
  groupSexCounts,
  moveLearner,
  randomizeGroups,
  sameGroupArrangement,
  shuffle,
  type GroupMode,
} from "../../domain/tools";
import { LearnerAvatar } from "../roster/LearnerAvatar";
import { GROUP_COLOR_SCHEMES, type GroupColor } from "./colors";

function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error("Clipboard is unavailable"));
}

export function RandomizerPanel({ load }: { load: TeachingLoad }) {
  const roster = load.learners.filter((learner) => !learner.transferredOutTerm);
  const maximum = Math.min(20, roster.length);
  const [mode, setMode] = useState<GroupMode>("balanced");
  const [groupCount, setGroupCount] = useState(2);
  const [groups, setGroups] = useState<Learner[][]>([]);
  const [colors, setColors] = useState<GroupColor[]>([]);
  const [original, setOriginal] = useState<Learner[][]>([]);
  const [history, setHistory] = useState<Learner[][][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = Math.min(Math.max(2, groupCount), Math.max(2, maximum));

  const randomize = () => {
    try {
      const next = randomizeGroups(roster, count, mode);
      const nextColors = shuffle([...GROUP_COLOR_SCHEMES]).slice(0, next.length);
      setGroups(next);
      setOriginal(next.map((group) => [...group]));
      setColors(nextColors);
      setHistory([]);
      setSelectedId(null);
      setError(null);
      setNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not randomize groups.");
    }
  };

  const applyMove = (toIndex: number, learnerId = selectedId) => {
    if (!learnerId || groups.length === 0) return;
    const before = groups.map((group) => [...group]);
    const next = moveLearner(groups, learnerId, toIndex);
    if (sameGroupArrangement(before, next)) return;
    setHistory((current) => [...current.slice(-29), before]);
    setGroups(next);
    setSelectedId(null);
    setNotice("Group arrangement updated.");
  };

  const onDrop = (event: React.DragEvent<HTMLElement>, toIndex: number) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || selectedId;
    applyMove(toIndex, id);
  };

  const copyGroups = async () => {
    try {
      await copyText(formatGroupsPlainText(groups, learnerDisplayName));
      setNotice("Group lists copied.");
    } catch {
      setError("Could not copy groups.");
    }
  };

  if (maximum < 2) {
    return <p className="muted">Add at least two active learners to create groups.</p>;
  }

  return (
    <div className="tools-panel">
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}
      <div className="tools-controls no-print">
        <div className="tool-stat">
          <strong>{roster.length}</strong> eligible learners
        </div>
        <label>
          Number of groups
          <input
            type="number"
            min={2}
            max={maximum}
            value={count}
            onChange={(event) => setGroupCount(Number(event.target.value) || 2)}
          />
        </label>
        <div className="tool-segmented" role="group" aria-label="Grouping mode">
          <button type="button" className={mode === "random" ? "active" : ""} onClick={() => setMode("random")}>
            Complete random
          </button>
          <button type="button" className={mode === "balanced" ? "active" : ""} onClick={() => setMode("balanced")}>
            Balance by sex
          </button>
        </div>
        <div className="tools-actions">
          <button type="button" className="primary" onClick={randomize}>
            {groups.length ? "Randomize again" : "Randomize"}
          </button>
          <button type="button" className="ghost" disabled={!groups.length} onClick={() => void copyGroups()}>
            Copy
          </button>
          <button type="button" className="ghost" disabled={!groups.length} onClick={() => printGroupLists()}>
            Print
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!history.length}
            onClick={() => {
              const previous = history[history.length - 1];
              if (!previous) return;
              setGroups(previous);
              setHistory(history.slice(0, -1));
            }}
          >
            Undo move
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!original.length || sameGroupArrangement(groups, original)}
            onClick={() => setGroups(original.map((group) => [...group]))}
          >
            Restore randomized
          </button>
        </div>
      </div>
      {groups.length > 0 && (
        <p className="muted no-print">Tap a learner, then tap a group to move them. On desktop you can also drag by the grip.</p>
      )}
      {groups.length === 0 ? (
        <p className="muted">Choose the number of groups and randomize the class.</p>
      ) : (
        <div className="group-results">
          {groups.map((members, index) => {
            const counts = groupSexCounts(members);
            const color = colors[index] || GROUP_COLOR_SCHEMES[index % GROUP_COLOR_SCHEMES.length];
            return (
              <section
                key={index}
                className="group-result"
                style={{ ["--group-accent" as string]: color.accent }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, index)}
              >
                <header className="group-result__header">
                  <button type="button" className="group-result__title-btn" onClick={() => applyMove(index)}>
                    <span className="group-result__swatch" title={`${color.name} group color`} aria-hidden="true" />
                    Group {index + 1}
                  </button>
                  <span className="group-result__sex">
                    M {counts.M} · F {counts.F}
                    {counts.U ? ` · Unspecified ${counts.U}` : ""}
                  </span>
                  <span className="group-result__count">{members.length}</span>
                </header>
                <ol className="group-result__list">
                  {members.map((learner) => (
                    <li
                      key={learner.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", learner.id);
                        setSelectedId(learner.id);
                      }}
                    >
                      <button
                        type="button"
                        className={selectedId === learner.id ? "group-learner active" : "group-learner"}
                        onClick={() => setSelectedId(learner.id === selectedId ? null : learner.id)}
                      >
                        <span className="group-result__drag-handle" aria-hidden="true">
                          ⋮⋮
                        </span>
                        <LearnerAvatar presetId={learner.avatarPresetId} size="sm" />
                        <span>{learnerDisplayName(learner)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
      <div className="tools-print print-only" aria-hidden="true">
        <h2>
          G{load.gradeLevel} {load.section} — {load.subject}
        </h2>
        <p>Group lists</p>
        {groups.map((members, index) => (
          <section key={index} className="tools-print-group" style={{ ["--group-accent" as string]: (colors[index] || GROUP_COLOR_SCHEMES[0]).accent }}>
            <h3>Group {index + 1}</h3>
            <ol>
              {members.map((learner) => (
                <li key={learner.id}>{learnerDisplayName(learner)}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
