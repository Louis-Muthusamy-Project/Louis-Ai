import React from "react";

import styles from "./button.module.css";

export default function Button({

    children,

    onClick,

    disabled = false,

    type = "button",

    variant = "primary",

    className = ""

}) {

    return (

        <button

            type={type}

            disabled={disabled}

            onClick={onClick}

            className={`

                ${styles.button}

                ${styles[variant]}

                ${className}

            `}

        >

            {children}

        </button>

    );

}