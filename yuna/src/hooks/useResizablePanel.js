import { useState, useCallback, useRef, useEffect } from "react";

/**
 * ==========================================
 * useResizablePanel
 * ------------------------------------------
 * Real drag-to-resize for a fixed-width flex panel (e.g. the Coding
 * Explorer or the Agent/Terminal/Git side panel) - not a decorative
 * handle. Tracks the live width in state, clamps it to [min, max] on
 * every mouse move while dragging, and persists the last width to
 * localStorage (this app already persists other UI state that way, see
 * store/authStore.js) so the size a user picks survives a reload.
 *
 * `direction` describes which side the handle sits on relative to the
 * panel it resizes:
 *   "right" - handle on the panel's right/bottom edge - dragging
 *             right/down grows it (e.g. Explorer's own right edge).
 *   "left"  - handle on the panel's left/top edge - dragging left/up
 *             grows it (e.g. the AI panel's left edge, or the bottom
 *             panel's top edge).
 *
 * `orientation` ("horizontal", the default, or "vertical") picks which
 * mouse axis drives the resize - horizontal panels (Explorer, AI panel)
 * track clientX and expose `.width`; a vertical panel (the bottom
 * Terminal/Problems/Output panel) tracks clientY and should read the
 * same returned value as `.height` instead - both are always present.
 */
export default function useResizablePanel({
    storageKey,
    defaultWidth,
    min,
    max,
    direction = "right",
    orientation = "horizontal"
}) {
    const [size, setSize] = useState(() => {
        if (typeof window === "undefined") return defaultWidth;
        const stored = window.localStorage.getItem(storageKey);
        const parsed = stored ? parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : defaultWidth;
    });
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ pos: 0, size: defaultWidth });

    const clamp = useCallback((value) => Math.min(max, Math.max(min, value)), [min, max]);

    const onMouseMove = useCallback((e) => {
        const pos = orientation === "vertical" ? e.clientY : e.clientX;
        const delta = pos - dragStart.current.pos;
        const signedDelta = direction === "right" ? delta : -delta;
        setSize(clamp(dragStart.current.size + signedDelta));
    }, [direction, orientation, clamp]);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", stopResizing);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setSize((current) => {
            try {
                window.localStorage.setItem(storageKey, String(current));
            } catch {
                // best-effort persistence only - a full/unavailable
                // localStorage should never break resizing itself
            }
            return current;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onMouseMove, storageKey]);

    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        const pos = orientation === "vertical" ? e.clientY : e.clientX;
        dragStart.current = { pos, size };
        setIsResizing(true);
        document.body.style.cursor = orientation === "vertical" ? "row-resize" : "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", stopResizing);
    }, [size, orientation, onMouseMove, stopResizing]);

    // Cleanup if the component unmounts mid-drag.
    useEffect(() => () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", stopResizing);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, [onMouseMove, stopResizing]);

    return { width: size, height: size, isResizing, onMouseDown };
}
