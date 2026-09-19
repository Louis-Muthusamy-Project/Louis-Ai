import React from "react";

import styles from "./resizeHandle.module.css";

/**
 * A thin draggable divider between two Coding panels. Purely a
 * mousedown-forwarding UI element - all the actual resize math/state
 * lives in useResizablePanel, so this stays a small, reusable piece.
 * `orientation="vertical"` renders a horizontal divider (row-resize,
 * for the bottom Terminal panel's height) instead of the default
 * vertical divider (col-resize, for side panels' width).
 */
export default function ResizeHandle({ onMouseDown, isResizing, orientation = "horizontal" }) {
    const base = orientation === "vertical" ? styles.handleRow : styles.handle;
    return (
        <div
            className={isResizing ? `${base} ${styles.active}` : base}
            onMouseDown={onMouseDown}
            role="separator"
            aria-orientation={orientation === "vertical" ? "horizontal" : "vertical"}
            aria-label="Resize panel"
        />
    );
}
