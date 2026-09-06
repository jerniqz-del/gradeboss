import { useState } from "react";
import { Icon } from "../../Icon";
import { buildGradeTransferFromLoad, gradeTransferFilename } from "../../domain/advisory";
import { isMapehSubject } from "../../domain/grading";
import { createDefaultProfile, type TeacherProfile } from "../../models/teacher-profile";
import type { TeachingLoad } from "../../models/teaching-load";
import type { MapePart, Term } from "../../models/types";
import { ensureStorageReady, getTeacherProfile } from "../../storage/init";
import { buildSummaryCsv, buildTermGridCsv, csvFilename } from "./csv";
import { downloadJson, downloadText, downloadBlob } from "./download";
import { buildExcelExportPayload } from "./excel-payload";
import { fillExcelWorkbook, loadEcrTemplate, workbookToBlob } from "./excel";
import { reportFilename } from "./names";
import { downloadClassAnalysisPdf } from "./pdf-analysis";
import { downloadClassRecordPdf } from "./pdf-class-record";
import { downloadLearnerCardsPdf } from "./pdf-learner";
import { downloadTermCompletionPdf } from "./pdf-completion";
import { printGradingSheet } from "./print";

async function teacherProfile(): Promise<TeacherProfile> {
  const db = await ensureStorageReady();
  return (await getTeacherProfile(db)) || createDefaultProfile();
}

export function SheetExportBar({
  load,
  tab,
  mapePart,
}: {
  load: TeachingLoad;
  tab: Term | "summary";
  mapePart?: MapePart;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, action: () => void | Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const downloadCurrent = () => {
    if (tab === "summary") {
      downloadText(csvFilename(load, "summary"), buildSummaryCsv(load), "text/csv");
      return;
    }
    const suffix = mapePart ? `term-${tab}-${mapePart}` : `term-${tab}`;
    downloadText(csvFilename(load, suffix), buildTermGridCsv(load, tab, mapePart), "text/csv");
  };

  const exportTransfer = async () => {
    if (tab === "summary") return;
    const profile = await teacherProfile();
    const payload = buildGradeTransferFromLoad(load, profile, tab, {
      mapePart: isMapehSubject(load.subject) ? mapePart : undefined,
    });
    downloadJson(gradeTransferFilename(payload), payload);
  };

  const exportExcel = async () => {
    const profile = await teacherProfile();
    const payload = buildExcelExportPayload(load, profile);
    const workbook = fillExcelWorkbook(payload, await loadEcrTemplate());
    downloadBlob(reportFilename(load, "ecr", "xlsx"), workbookToBlob(workbook));
  };

  return (
    <div className="sheet-export-wrap no-print">
      {error && <div className="banner error">{error}</div>}
      <div className="sheet-export">
        <button type="button" className="ghost" disabled={!!busy} onClick={downloadCurrent}>
          <Icon name="download" /> {tab === "summary" ? "Download summary CSV" : `Download Term ${tab} CSV`}
        </button>
        {tab !== "summary" && (
          <button
            type="button"
            className="ghost"
            disabled={!!busy}
            onClick={() => downloadText(csvFilename(load, "summary"), buildSummaryCsv(load), "text/csv")}
          >
            <Icon name="download" /> Summary CSV
          </button>
        )}
        {tab !== "summary" && (
          <button type="button" className="ghost" disabled={!!busy} onClick={() => void run("transfer", exportTransfer)}>
            <Icon name="download" /> Grade Transfer JSON
          </button>
        )}
        <button type="button" className="ghost" disabled={!!busy} onClick={printGradingSheet}>
          <Icon name="printer" /> Print (A4 landscape)
        </button>
        <details className="report-menu">
          <summary className="ghost">
            <Icon name="download" /> {busy ? `${busy}…` : "Excel & PDF reports"}
          </summary>
          <div className="report-menu-panel">
            <button type="button" className="ghost" disabled={!!busy} onClick={() => void run("Excel", exportExcel)}>
              Excel (DepEd ECR)
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy}
              onClick={() => void run("class record", async () => {
                downloadClassRecordPdf(load, { tab, mapePart, profile: await teacherProfile() });
              })}
            >
              Class record PDF (this tab)
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy}
              onClick={() => void run("full class record", async () => {
                downloadClassRecordPdf(load, { tab: "full", profile: await teacherProfile() });
              })}
            >
              Full class record PDF
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy}
              onClick={() => void run("learner cards", async () => {
                downloadLearnerCardsPdf(load, await teacherProfile());
              })}
            >
              Learner progress cards PDF
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy}
              onClick={() => void run("completion", async () => {
                downloadTermCompletionPdf(load, await teacherProfile());
              })}
            >
              Term completion PDF
            </button>
            <button
              type="button"
              className="ghost"
              disabled={!!busy}
              onClick={() => void run("analysis", async () => {
                downloadClassAnalysisPdf(load, tab, mapePart, await teacherProfile());
              })}
            >
              Class analysis PDF
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
