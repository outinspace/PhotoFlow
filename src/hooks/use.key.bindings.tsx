import { useEffect } from "react";

interface KeyBinding {
  cmd: string[],
  callback: () => any,
}

export const useKeyBindings = (props: KeyBinding[], deps: any[]) => {
  const currentlyPressedKeys = new Set();

  const areAllKeyPressed = (keys: string[]) => {
    for (const key of keys) {
      if (!currentlyPressedKeys.has(key)) return false;
    }
    return true;
  }

  const bindingsKeyDown = (e: KeyboardEvent) => {
    // Don't let shortcuts fire (or swallow keystrokes) while the user is typing
    // in a text field — e.g. 'd' in the album-name input must not open Delete.
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
      return;
    }

    currentlyPressedKeys.add(e.key);
    props.forEach((binding) => {
      if (areAllKeyPressed(binding.cmd)) {
        // Stop the event before it reaches a focused element's own handlers.
        // A focused <video controls> scrubs on arrow keys via listeners in its
        // shadow DOM, which run before a bubble-phase document handler. By
        // listening in the capture phase and stopping propagation here, the
        // event never reaches the video, so the binding takes precedence.
        e.preventDefault();
        e.stopPropagation();
        binding.callback();
      }
    });
  };

  const bindingsKeyUp = (e: KeyboardEvent) => {
    currentlyPressedKeys.delete(e.key);
  }

  useEffect(() => {
    document.addEventListener("keydown", bindingsKeyDown, { capture: true });
    document.addEventListener("keyup", bindingsKeyUp, { capture: true });
    return () => {
      document.removeEventListener("keydown", bindingsKeyDown, { capture: true });
      document.removeEventListener("keyup", bindingsKeyUp, { capture: true });
    };
  }, deps);
};
