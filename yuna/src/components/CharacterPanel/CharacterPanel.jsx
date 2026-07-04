import React from "react";
import { motion } from "framer-motion";
import Live2DCanvas from "../../live2d/Live2DCanvas";

import styles from "./characterPanel.module.css";
import useCharacterState from "../../hooks/useCharacterState";
import useVoice from "../../hooks/useVoice";

export default function CharacterPanel() {
  const {

    speaking

  } = useVoice();

  const {

    isIdle,

    isListening,

    isThinking,

    isTalking,

    isHappy,

    isSad,

    isExcited

  } = useCharacterState();

  return (

    <div className={styles.wrap}>

      <div className={styles.cityBg} />

      <motion.div

        className={styles.characterWrap}

        animate={{

          scale:

           isTalking || speaking
              ? 1.03
              : isThinking
                ? 1.02
                : isListening
                  ? 1.01
                  : 1,

          y:

            isIdle
              ? [0, -4, 0]
              : 0,

          rotate:

            isHappy
              ? [0, 2, -2, 0]
              : isExcited
                ? [0, 3, -3, 0]
                : 0

        }}

        transition={{

          duration: 2,

          repeat:

            isIdle ||
              isHappy ||
              isExcited

              ? Infinity

              : 0

        }}

      >

        <div className={styles.orbGlow} />

        <Live2DCanvas />

        <motion.div

          className={styles.breath}

          animate={{

            opacity:

            isTalking || speaking

                ? .40

                : .20,

            scale:

            isTalking || speaking

                ? 1.15

                : 1

          }}

          transition={{

            repeat: Infinity,

            duration: 2

          }}

        />

      </motion.div>

      <div className={styles.idleHints}>

        <div className={styles.hintLine} />

        <div className={styles.hintLine} />

        <div className={styles.hintLine} />

      </div>

    </div>

  );

}