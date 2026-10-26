// iOS Safari has no vibration API, but since iOS 18 toggling an <input switch>
// plays the system selection haptic. Clicking a hidden label for one triggers it.
let label: HTMLLabelElement | undefined;

export function haptic() {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
    return;
  }
  if (!label) {
    label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
  }
  label.click();
}
