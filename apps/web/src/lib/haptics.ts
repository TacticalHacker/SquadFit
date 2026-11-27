/**
 * Feature 019: the PR haptic. Call it synchronously inside the tap handler that caused the PR.
 * Android: a double buzz. iPhone (Safari has no vibrate): clicking the label of a `<input type="checkbox" switch>`
 * gives one system tick on iOS 18+. Anything else: nothing.
 *
 * The switch must live inside the open modal `<dialog>` (the drawer): while a modal dialog is open everything
 * outside it is inert, and a click on an inert label does nothing.
 */
export function prHaptic(): void {
  try {
    if (typeof navigator === "undefined" || typeof document === "undefined") return;
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate([15, 40, 15]);
      return;
    }
    const host = document.querySelector<HTMLDialogElement>("dialog[open]") ?? document.body;
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.appendChild(input);
    host.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // No haptics on this device: skip silently.
  }
}
