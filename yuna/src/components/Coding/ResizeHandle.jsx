import React from "react";

import styles from "./resizeHandle.module.css";

/**
 * A thin draggable divider between two Coding panels. Purely a
 * mousedown-forwarding UI element - all the actual resize math/state
 * lives in useResizablePanel, so this stays a small, reusable piece.
 */
export default function ResizeHandle({ onMouseDown, isResizing }) {
    return (
        <div
            className={isResizing ? `${styles.handle} ${styles.active}` : styles.handle}
            onMouseDown={onMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
        />
    );
}
