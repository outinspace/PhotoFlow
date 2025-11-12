export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line no-undef
    window.navigator.standalone === true // for iOS Safari
  );
}
