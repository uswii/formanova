import { useEffect, useCallback, useRef } from "react";

/** Detect macOS for shortcut labels */
export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** Modifier key label for the current platform */
export const modKey = isMac ? "⌘" : "Ctrl";

// ── Shortcut definition (shared between hook & UI panel) ───────────────

export interface ShortcutDef {
  keys: string[];
  desc: string;
}

export interface ShortcutSection {
  title: string;
  shortcuts: ShortcutDef[];
}

/** The single source of truth for all CAD keyboard shortcuts. */
export const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Transform Modes",
    shortcuts: [
      { keys: ["G"], desc: "Move" },
      { keys: ["R"], desc: "Rotate" },
      { keys: ["S"], desc: "Scale" },
      { keys: ["Esc"], desc: "Orbit (cancel transform)" },
    ],
  },
  {
    title: "Mesh Editing",
    shortcuts: [
      { keys: ["Delete", "/", "Backspace", "/", `${modKey}+Backspace`], desc: "Delete selected" },
      { keys: ["Shift+D"], desc: "Duplicate selected" },
      { keys: ["W"], desc: "Toggle wireframe" },
    ],
  },
  {
    title: "Clipboard",
    shortcuts: [
      { keys: ["Ctrl+C", "/", "⌘+C"], desc: "Copy selected" },
      { keys: ["Ctrl+V", "/", "⌘+V"], desc: "Paste" },
      { keys: ["Ctrl+X", "/", "⌘+X"], desc: "Cut selected" },
    ],
  },
  {
    title: "Selection",
    shortcuts: [
      { keys: ["Ctrl+A", "/", "⌘+A"], desc: "Select all" },
      { keys: ["Esc"], desc: "Deselect all" },
    ],
  },
  {
    title: "History",
    shortcuts: [
      { keys: ["Ctrl+Z", "/", "⌘+Z"], desc: "Undo" },
      { keys: ["Ctrl+Shift+Z", "/", "⌘+Shift+Z", "/", "Ctrl+Y"], desc: "Redo" },
    ],
  },
  {
    title: "Mouse Controls",
    shortcuts: [
      { keys: ["Scroll"], desc: "Zoom" },
      { keys: ["Left Drag"], desc: "Orbit" },
      { keys: ["Right Drag"], desc: "Pan" },
      { keys: ["Click"], desc: "Select mesh" },
    ],
  },
];

// ── Hook ───────────────────────────────────────────────────────────────

export interface CADShortcutActions {
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSetTransformMode: (mode: string) => void;
  onToggleWireframe: () => void;
  onToggleShortcutsPanel: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onResetTransform?: () => void;
  /** If true, the workspace is active and shortcuts should fire */
  enabled: boolean;
}

/**
 * Centralized keyboard shortcut manager for the CAD editor.
 * Attaches a single `window` keydown listener so shortcuts work
 * regardless of which element is focused (except text inputs).
 */
export function useCADKeyboardShortcuts(actions: CADShortcutActions) {
  // Keep actions ref-stable to avoid re-attaching listener on every render
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!actionsRef.current.enabled) return;

    const handler = (e: KeyboardEvent) => {
      const a = actionsRef.current;
      if (!a.enabled) return;

      // Skip when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // ── Modifier combos first (most specific → least specific) ──

      // Ctrl/Cmd + Shift + A → Deselect all
      if (mod && e.shiftKey && key === "a") {
        e.preventDefault();
        a.onDeselectAll();
        return;
      }

      // Ctrl/Cmd + Shift + Z → Redo
      if (mod && e.shiftKey && key === "z") {
        e.preventDefault();
        a.onRedo();
        return;
      }

      // Ctrl/Cmd + Y → Redo (alt)
      if (mod && key === "y") {
        e.preventDefault();
        a.onRedo();
        return;
      }

      // Ctrl/Cmd + Z → Undo
      if (mod && key === "z") {
        e.preventDefault();
        a.onUndo();
        return;
      }

      // Ctrl/Cmd + C → Copy
      if (mod && key === "c") {
        e.preventDefault();
        a.onCopy?.();
        return;
      }

      // Ctrl/Cmd + V → Paste
      if (mod && key === "v") {
        e.preventDefault();
        a.onPaste?.();
        return;
      }

      // Ctrl/Cmd + X → Cut
      if (mod && key === "x") {
        e.preventDefault();
        a.onCut?.();
        return;
      }

      // Ctrl/Cmd + A → Select all
      if (mod && key === "a") {
        e.preventDefault();
        a.onSelectAll();
        return;
      }

      // Cmd + Backspace → Delete (macOS convention)
      if (mod && key === "backspace") {
        e.preventDefault();
        a.onDelete();
        return;
      }

      // Don't intercept other Ctrl/Cmd combos (browser shortcuts)
      if (mod) return;

      // Alt + R → Reset Transform
      if (e.altKey && key === "r") {
        e.preventDefault();
        a.onResetTransform?.();
        return;
      }
      if (e.shiftKey && key === "d") {
        e.preventDefault();
        a.onDuplicate();
        return;
      }

      // ── Single keys ──

      // ? → Toggle shortcuts panel
      if (e.key === "?") {
        a.onToggleShortcutsPanel();
        return;
      }

      switch (key) {
        case "g":
          a.onSetTransformMode("translate");
          break;
        case "r":
          a.onSetTransformMode("rotate");
          break;
        case "s":
          a.onSetTransformMode("scale");
          break;
        case "escape":
          a.onDeselectAll();
          a.onSetTransformMode("orbit");
          break;
        case "w":
          a.onToggleWireframe();
          break;
        case "delete":
          e.preventDefault();
          a.onDelete();
          break;
        case "backspace":
          // Plain Backspace or Cmd+Backspace (macOS)
          e.preventDefault();
          a.onDelete();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions.enabled]);
}
