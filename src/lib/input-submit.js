export function shouldSubmitOnEnter({
  key,
  shiftKey,
  isComposing,
  nativeEventIsComposing,
  keyCode,
}) {
  if (key !== 'Enter' || shiftKey) {
    return false;
  }

  if (isComposing || nativeEventIsComposing || keyCode === 229) {
    return false;
  }

  return true;
}
