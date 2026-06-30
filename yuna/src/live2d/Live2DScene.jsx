import { useEffect, useRef } from "react";
import { LifeController } from "./lifeController";
import { useLifeLoop } from "./useLifeLoop";
import { LipSyncController } from "./lipSyncController";

export default function Live2DScene() {
    const modelRef = useRef(null);
    const controllerRef = useRef(null);
    const lipSyncRef = useRef(null);

    useEffect(() => {
        // Assume Live2D model already loaded
        const model = modelRef.current;

        lipSyncRef.current = new LipSyncController(model);

        const handleSpeak = (e) => {
            if (e.detail.speaking) {
                lipSyncRef.current.start();
            } else {
                lipSyncRef.current.stop();
            }
        };

        controllerRef.current = new LifeController(model);
        
        window.addEventListener("yuna_speaking", handleSpeak);

        return () => {
            window.removeEventListener("yuna_speaking", handleSpeak);
            lipSyncRef.current?.stop();
        };

    }, []);

    useLifeLoop(controllerRef.current);

    return (
        <div>
            <canvas id="live2d-canvas" />
        </div>
    );
}
