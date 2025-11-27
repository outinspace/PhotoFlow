interface NavigatorStandalone extends Navigator {
  standalone?: boolean;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as NavigatorStandalone).standalone === true // for iOS Safari
  );
}

export const IS_STANDALONE = isStandalone();
