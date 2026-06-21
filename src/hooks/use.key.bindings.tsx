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
    currentlyPressedKeys.add(e.key);
    props.forEach((binding) => {
      if (areAllKeyPressed(binding.cmd)) {
        // Prevent the browser's default action for the matched key (e.g. a
        // focused <video controls> scrubbing on arrow keys) so the binding
        // takes precedence over native behavior.
        e.preventDefault();
        binding.callback();
      }
    });
  };

  const bindingsKeyUp = (e: KeyboardEvent) => {
    currentlyPressedKeys.delete(e.key);
  }

  useEffect(() => {
    document.addEventListener("keydown", bindingsKeyDown);
    document.addEventListener("keyup", bindingsKeyUp);
    return () => {
      document.removeEventListener("keydown", bindingsKeyDown);
      document.removeEventListener("keyup", bindingsKeyUp);
    };
  }, deps);
};
