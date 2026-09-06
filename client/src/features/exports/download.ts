export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, "application/json");
}

export function backupFilename(sealed: boolean, exportedAt = new Date()): string {
  const day = exportedAt.toISOString().slice(0, 10);
  return sealed ? `gradeboss-backup-${day}.sealed.json` : `gradeboss-backup-${day}.json`;
}
