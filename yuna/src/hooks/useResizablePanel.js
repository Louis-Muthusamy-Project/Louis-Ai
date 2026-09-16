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
 *   "right" - handle on the panel's right edge (e.g. Explorer, on the
 *             left side of the layout) - dragging right grows it.
 *   "left"  - handle on the panel's left edge (e.g. the right side
 *             panel) - dragging left grows it.
 */
export default function useResizablePanel({
    storageKey,
    defaultWidth,
    min,
    max,
    direction = "right"
}) {
    const [width, setWidth] = useState(() => {
        if (typeof window === "undefined") return defaultWidth;
        const stored = window.localStorage.getItem(storageKey);
        const parsed = stored ? parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : defaultWidth;
    });
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef({ x: 0, width: defaultWidth });

    const clamp = useCallback((value) => Math.min(max, Math.max(min, value)), [min, max]);

    const onMouseMove = useCallback((e) => {
        const delta = e.clientX - dragStart.current.x;
        const signedDelta = direction === "right" ? delta : -delta;
        setWidth(clamp(dragStart.current.width + signedDelta));
    }, [direction, clamp]);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", stopResizing);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setWidth((current) => {
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
        dragStart.current = { x: e.clientX, width };
        setIsResizing(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", stopResizing);
    }, [width, onMouseMove, stopResizing]);

    // Cleanup if the component unmounts mid-drag.
    useEffect(() => () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", stopResizing);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, [onMouseMove, stopResizing]);

    return { width, isResizing, onMouseDown };
}
