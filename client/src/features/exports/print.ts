/** Mark the document for landscape sheet printing, then open the print dialog. */
export function printGradingSheet(): void {
  document.documentElement.classList.add("print-sheet");
  const cleanup = () => {
    document.documentElement.classList.remove("print-sheet");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.setTimeout(() => window.print(), 0);
}
