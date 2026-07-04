import { useEffect, useState } from "react";

import YunaEngine from "../core/YunaEngine";

export default function useYunaEngine() {

    const [state, setState] = useState(

        YunaEngine.getState()

    );

    useEffect(() => {

        const update = value => {

            setState(value);

        };

        YunaEngine.on("state", update);

        return () => {

            YunaEngine.off(

                "state",

                update

            );

        };

    }, []);

    return {

        state,

        setState: YunaEngine.setState.bind(YunaEngine)

    };

}