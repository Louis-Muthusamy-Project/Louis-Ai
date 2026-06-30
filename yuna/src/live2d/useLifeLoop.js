import { useEffect } from "react";

export function useLifeLoop(controller) {
    useEffect(() => {
        if (!controller) return;

        let lastTime = performance.now();

        const loop = (time) => {
            const delta = time - lastTime;
            lastTime = time;

            controller.update(delta);

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }, [controller]);
}