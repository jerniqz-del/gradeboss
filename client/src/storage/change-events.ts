export const DATA_SAVED = "gradeboss:data-saved";
export function notifyDataSaved(label = "Saved workspace changes") {
  window.dispatchEvent(new CustomEvent(DATA_SAVED, { detail: label }));
}