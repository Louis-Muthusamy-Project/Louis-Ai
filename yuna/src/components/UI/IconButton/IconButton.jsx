import React from "react";

import styles from "./iconButton.module.css";

export default function IconButton({

    children,

    onClick,

    disabled = false,

    className = ""

}) {

    return (

        <button

            disabled={disabled}

            onClick={onClick}

            className={`

                ${styles.button}

                ${className}

            `}

        >

            {children}

        </button>

    );

}