import { Icon } from "../../Icon";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { buildSummaryCsv, buildTermGridCsv, csvFilename } from "./csv";
import { downloadText } from "./download";
import { printGradingSheet } from "./print";

export function SheetExportBar({
  load,
  tab,
  mapePart,
}: {
  load: TeachingLoad;
  tab: Term | "summary";
  mapePart?: MapePart;
}) {
  const downloadCurrent = () => {
    if (tab === "summary") {
      downloadText(csvFilename(load, "summary"), buildSummaryCsv(load), "text/csv");
      return;
    }
    const suffix = mapePart ? `term-${tab}-${mapePart}` : `term-${tab}`;
    downloadText(csvFilename(load, suffix), buildTermGridCsv(load, tab, mapePart), "text/csv");
  };

  return (
    <div className="sheet-export no-print">
      <button type="button" className="ghost" onClick={downloadCurrent}>
        <Icon name="download" /> {tab === "summary" ? "Download summary CSV" : `Download Term ${tab} CSV`}
      </button>
      {tab !== "summary" && (
        <button
          type="button"
          className="ghost"
          onClick={() => downloadText(csvFilename(load, "summary"), buildSummaryCsv(load), "text/csv")}
        >
          <Icon name="download" /> Summary CSV
        </button>
      )}
      <button type="button" className="ghost" onClick={printGradingSheet}>
        <Icon name="printer" /> Print (A4 landscape)
      </button>
    </div>
  );
}
