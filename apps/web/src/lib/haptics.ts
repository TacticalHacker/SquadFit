/**
 * Feature 019: the PR haptic. Call it inside the tap handler that caused the PR.
 * Android: a double buzz. iPhone (Safari has no vibrate): clicking the label of a hidden
 * `<input type="checkbox" switch>` gives one system tick on iOS 18+. Anything else: nothing.
 */
let iosSwitch: HTMLLabelElement | null = null;

function switchLabel(): HTMLLabelElement {
  if (iosSwitch?.isConnected) return iosSwitch;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = label;
  return label;
}

export function prHaptic(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([15, 40, 15]);
      return;
    }
    if (typeof document !== "undefined") switchLabel().click();
  } catch {
    // No haptics on this device: skip silently.
  }
}
