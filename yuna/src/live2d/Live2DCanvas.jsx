import { useEffect, useRef } from "react";
import Live2DManager from "./Live2DManager";

export default function Live2DCanvas() {

    const canvasRef = useRef(null);

    useEffect(() => {

        if (!canvasRef.current) return;

        Live2DManager.initialize(
            canvasRef.current
        );

        Live2DManager.loadModel();

    }, []);

    return (

        <canvas
            ref={canvasRef}
            style={{
                width: "100%",
                height: "100%"
            }}
        />

    );

}