function printWithClass(className: string): void {
  document.documentElement.classList.add(className);
  const cleanup = () => {
    document.documentElement.classList.remove(className);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.setTimeout(() => window.print(), 0);
}

/** Mark the document for landscape sheet printing, then open the print dialog. */
export function printGradingSheet(): void {
  printWithClass("print-sheet");
}

/** Print the SF2 landscape report (hides app chrome, shows `.sf2-print`). */
export function printSf2Report(): void {
  printWithClass("print-sf2");
}
