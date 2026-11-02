/** Interpret semantic key information before legacy numeric codes; never mutate DOM events. */
export function isRemoteConfirmEvent(event: KeyboardEvent): boolean {
  if (!event) return false;
  if (event.key?.length === 1 && !['\n', '\r'].includes(event.key)) return false;
  if (['Enter', 'Select', 'Ok', 'OK'].includes(event.key)) return true;
  // A real physical location is useful when a WebView omits key, but an explicit
  // Enter/Select above takes precedence over Android's contradictory KeyB code.
  if (/^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(event.code)) return false;
  if (['Enter', 'NumpadEnter', 'Select'].includes(event.code)) return true;
  return [13, 10, 65385, 66].includes(event.keyCode || event.which);
}

export function getTvKeyboardText(event: KeyboardEvent): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || isRemoteConfirmEvent(event)) return null;
  if (event.key?.length === 1 && !['\n', '\r'].includes(event.key)) return event.key;
  if (event.key && event.key !== 'Unidentified') return null;
  if (/^Key[A-Z]$/.test(event.code)) return event.shiftKey ? event.code.slice(3) : event.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  return null;
}
