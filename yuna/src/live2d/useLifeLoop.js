import { useEffect } from "react";

export function useLifeLoop(controller) {
    useEffect(() => {
        if (!controller) return;

        let lastTime = performance.now();
        let animationFrameId = null;

        const loop = (time) => {
            const delta = time - lastTime;
            lastTime = time;

            controller.update(delta);

            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [controller]);
}
