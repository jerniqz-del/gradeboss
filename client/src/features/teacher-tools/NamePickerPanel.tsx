import { useEffect, useRef, useState } from "react";
import { createNamePicker, type NamePicker } from "../../domain/tools";
import { learnerDisplayName } from "../../models/learner";
import type { Learner } from "../../models/learner";
import type { TeachingLoad } from "../../models/teaching-load";
import { LearnerAvatar } from "../roster/LearnerAvatar";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function NamePickerPanel({ load }: { load: TeachingLoad }) {
  const roster = load.learners.filter((learner) => !learner.transferredOutTerm);
  const signature = roster.map((item) => item.id).join("|");
  const pickerRef = useRef<NamePicker<Learner> | null>(null);
  const tokenRef = useRef(0);
  const [selected, setSelected] = useState<Learner | null>(null);
  const [roulette, setRoulette] = useState<Learner | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [remaining, setRemaining] = useState(roster.length);

  useEffect(() => {
    const next = load.learners.filter((learner) => !learner.transferredOutTerm);
    pickerRef.current = createNamePicker(next);
    setSelected(null);
    setRoulette(null);
    setSpinning(false);
    setRemaining(next.length);
    tokenRef.current += 1;
  }, [load.id, load.learners, signature]);

  useEffect(() => () => {
    tokenRef.current += 1;
  }, []);

  const reveal = (learner: Learner | null, leftover: number) => {
    setSelected(learner);
    setRoulette(null);
    setSpinning(false);
    setRemaining(leftover);
  };

  const pick = () => {
    if (spinning || !roster.length || !pickerRef.current) return;
    const result = pickerRef.current.draw();
    if (!result.learner || roster.length < 2 || prefersReducedMotion()) {
      reveal(result.learner, result.remaining);
      return;
    }
    const token = ++tokenRef.current;
    setSpinning(true);
    setSelected(result.learner);
    let step = 0;
    const totalSteps = 18;
    const tick = () => {
      if (token !== tokenRef.current) return;
      if (step >= totalSteps) {
        reveal(result.learner, result.remaining);
        return;
      }
      const flash = roster[Math.floor((step * 7 + roster.length / 2) % roster.length)];
      setRoulette(flash);
      step += 1;
      const delay = 35 + Math.round((step / totalSteps) * (step / totalSteps) * 190);
      window.setTimeout(tick, delay);
    };
    window.setTimeout(tick, 45);
  };

  const reset = () => {
    tokenRef.current += 1;
    pickerRef.current?.reset();
    setSelected(null);
    setRoulette(null);
    setSpinning(false);
    setRemaining(roster.length);
  };

  const display = spinning ? roulette : selected;

  if (!roster.length) {
    return <p className="muted">Add learners to this class before using Name Picker.</p>;
  }

  return (
    <div className="tools-panel picker-panel">
      <div className={`name-picker-stage${spinning ? " is-spinning" : ""}`}>
        <p className="name-picker-status" role="status">
          {spinning
            ? `${roster.length} eligible learners · roulette spinning`
            : `${roster.length} eligible learners · ${selected ? remaining : roster.length} remaining`}
        </p>
        <div className="name-picker-selection">
          <div className={`name-picker-avatar${display ? "" : " is-empty"}${!spinning && selected ? " is-revealed" : ""}`}>
            {display ? <LearnerAvatar presetId={display.avatarPresetId} size="xl" decorative={false} /> : null}
          </div>
          <div
            className={`name-picker-name${spinning ? " is-spinning" : ""}${!spinning && selected ? " is-revealed" : ""}`}
            aria-live={spinning ? "off" : "polite"}
            aria-busy={spinning}
          >
            {display ? learnerDisplayName(display) : "Ready to pick"}
          </div>
        </div>
        <div className="tools-actions">
          <button type="button" className="primary" disabled={spinning} onClick={pick}>
            {spinning ? "Picking..." : selected ? "Pick another" : "Pick a learner"}
          </button>
          <button type="button" className="ghost" disabled={spinning} onClick={reset}>
            Reset draws
          </button>
        </div>
      </div>
    </div>
  );
}
