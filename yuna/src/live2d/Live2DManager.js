/**
 * ============================================================================
 * Live2DManager
 * ============================================================================
 * Manages PixiJS Application, Live2D Cubism 4 model instantiation,
 * render ticker, viewport scaling, and coordinator bindings.
 */

import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { Live2DCoordinator } from "./Live2DCoordinator";
import AudioQueue from "../services/audioQueue";

// Configure PixiJS global settings and Live2D registration
if (typeof window !== "undefined") {
    window.PIXI = PIXI;

    // Polyfill for PixiJS v7 EventBoundary compatibility with custom DisplayObjects
    if (PIXI.DisplayObject) {
        if (!PIXI.DisplayObject.prototype.isInteractive) {
            PIXI.DisplayObject.prototype.isInteractive = function () {
                return Boolean(
                    this.eventMode === "static" ||
                    this.eventMode === "dynamic" ||
                    this.interactive
                );
            };
        }
        if (!PIXI.DisplayObject.prototype.isInteractiveChildren) {
            PIXI.DisplayObject.prototype.isInteractiveChildren = function () {
                return Boolean(this.interactiveChildren !== false);
            };
        }
    }

    // Prevent WebGL checkMaxIfStatementsInShader(0) errors
    if (PIXI.settings) {
        PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL2;
        PIXI.settings.MAX_IF_STATEMENT_IN_SHADER = 16;
        PIXI.settings.STRICT_TEXTURE_CACHE = false;
    }
    if (PIXI.BatchRenderer) {
        PIXI.BatchRenderer.defaultMaxIfStatementsInShader = 16;
    }

    try {
        Live2DModel.registerTicker(PIXI.Ticker);
    } catch {
        // Ticker already registered
    }
}

class Live2DManager {
    constructor() {
        this.app = null;
        this.model = null;
        this.container = null;
        this.coordinator = new Live2DCoordinator();
        this.isLoading = false;
        this.isReady = false;
        this.modelPath = "/live2d/Hiyori/Hiyori.model3.json";
        this.tickerCallback = null;
        this.audioQueueUnsub = null;
        this.sessionToken = null;
    }

    /**
     * Initialize PixiJS Application and mount into a container DOM element.
     * @param {HTMLElement} container
     */
    async initialize(container) {
        if (!container) return;

        // Invalidate any ongoing asynchronous initialization
        this.destroy();

        const currentToken = Symbol("live2d_session");
        this.sessionToken = currentToken;
        this.container = container;

        const width = Math.max(container.clientWidth || 460, 300);
        const height = Math.max(container.clientHeight || 600, 400);

        try {
            this.app = new PIXI.Application({
                width,
                height,
                backgroundAlpha: 0,
                antialias: true,
                resolution: Math.min(window.devicePixelRatio || 1, 2),
                autoDensity: true,
            });

            // If destroyed while creating application, abort
            if (this.sessionToken !== currentToken) {
                if (this.app) {
                    this.app.destroy(true);
                    this.app = null;
                }
                return;
            }

            // Mount canvas view inside container
            const view = this.app.view;
            if (view) {
                view.style.display = "block";
                view.style.width = "100%";
                view.style.height = "100%";
                view.style.pointerEvents = "auto";
                container.appendChild(view);
            }

            // Wire AudioQueue state change and AnalyserNode to coordinator
            const analyser = AudioQueue.getAnalyserNode();
            if (analyser) {
                this.coordinator.setAudioAnalyser(analyser);
            }

            this.audioQueueUnsub = AudioQueue.onStateChange((isPlaying) => {
                this.coordinator.setSpeaking(isPlaying);
                if (isPlaying) {
                    const node = AudioQueue.getAnalyserNode();
                    if (node) this.coordinator.setAudioAnalyser(node);
                }
            });

            // Load Live2D model
            await this.loadModel(this.modelPath, currentToken);
        } catch (err) {
            console.error("[Live2DManager] Application initialization error:", err);
        }
    }

    /**
     * Load Cubism 4 Live2D model with async cancellation guarding.
     */
    async loadModel(url = this.modelPath, token = this.sessionToken) {
        if (!this.app || this.isLoading) return;
        this.isLoading = true;
        this.modelPath = url;

        try {
            console.log("[Live2DManager] Loading Cubism 4 model from:", url);

            // Load model with manual interaction control so our coordinator governs all motions
            const loadedModel = await Live2DModel.from(url, {
                autoInteract: false,
                idleMotionGroupName: "Idle",
            });

            // Check if this session was cancelled/destroyed during async load
            if (this.sessionToken !== token || !this.app || !this.app.stage) {
                console.log("[Live2DManager] Load session cancelled or destroyed.");
                return;
            }

            this.model = loadedModel;
            this.model.anchor.set(0.5, 0.5);
            this.model.eventMode = "none";
            this.model.interactive = false;
            this.model.interactiveChildren = false;

            // Add model to Pixi stage
            this.app.stage.eventMode = "none";
            this.app.stage.interactiveChildren = false;
            this.app.stage.removeChildren();
            this.app.stage.addChild(this.model);

            // Attach model to coordinator
            this.coordinator.setModel(this.model);

            // Adjust scale and position
            this.resize();

            // Setup main render ticker
            if (this.tickerCallback && this.app.ticker) {
                this.app.ticker.remove(this.tickerCallback);
            }

            this.tickerCallback = () => {
                if (!this.app || !this.app.ticker) return;
                const deltaSeconds = this.app.ticker.deltaMS / 1000;
                this.coordinator.tick(deltaSeconds);
            };
            this.app.ticker.add(this.tickerCallback);

            this.isReady = true;
            console.log("[Live2DManager] Live2D model successfully loaded and active.");
        } catch (error) {
            if (this.sessionToken === token) {
                console.error("[Live2DManager] Failed to load Live2D model:", error);
            }
        } finally {
            if (this.sessionToken === token) {
                this.isLoading = false;
            }
        }
    }

    /**
     * Resize and center model within viewport.
     */
    resize() {
        if (!this.app || !this.container || !this.app.renderer) return;

        const width = this.container.clientWidth || this.app.renderer.width;
        const height = this.container.clientHeight || this.app.renderer.height;

        if (width <= 0 || height <= 0) return;

        this.app.renderer.resize(width, height);

        if (this.model) {
            // Position model in center horizontally and vertically for portrait bust
            this.model.x = width * 0.5;
            this.model.y = height * 0.65;

            // Compute responsive fit scale
            const boundsWidth = this.model.width / (this.model.scale.x || 1);
            const boundsHeight = this.model.height / (this.model.scale.y || 1);

            const scaleX = (width * 0.95) / (boundsWidth || 1000);
            const scaleY = (height * 0.95) / (boundsHeight || 1000);
            const fitScale = Math.min(scaleX, scaleY) * 1.6; // Focused anime portrait zoom

            this.model.scale.set(fitScale);
        }
    }

    /**
     * User tap / interaction event.
     */
    handleTap() {
        if (!this.coordinator) return;
        this.coordinator.handleTapBody();
    }

    /**
     * Pointer move event.
     */
    handlePointerMove(clientX, clientY) {
        if (!this.coordinator || !this.container) return;
        const bounds = this.container.getBoundingClientRect();
        this.coordinator.handlePointerMove(clientX, clientY, bounds);
    }

    /**
     * Pointer leave event.
     */
    handlePointerLeave() {
        if (!this.coordinator) return;
        this.coordinator.handlePointerLeave();
    }

    /**
     * Synchronize emotion state.
     */
    setEmotionState(state) {
        if (this.coordinator) {
            this.coordinator.setEmotionState(state);
        }
    }

    /**
     * Synchronize speech state.
     */
    setSpeaking(isSpeaking) {
        if (this.coordinator) {
            this.coordinator.setSpeaking(isSpeaking);
        }
    }

    /**
     * Synchronize thinking state.
     */
    setThinking(isThinking) {
        if (this.coordinator) {
            this.coordinator.setThinking(isThinking);
        }
    }

    /**
     * Cleanup and destroy resources.
     */
    destroy() {
        this.sessionToken = null;

        if (this.audioQueueUnsub) {
            this.audioQueueUnsub();
            this.audioQueueUnsub = null;
        }

        if (this.app) {
            if (this.tickerCallback && this.app.ticker) {
                this.app.ticker.remove(this.tickerCallback);
                this.tickerCallback = null;
            }

            const view = this.app.view;
            if (view && view.parentElement) {
                view.parentElement.removeChild(view);
            }

            try {
                this.app.destroy(true, { children: true, texture: false, baseTexture: false });
            } catch (e) {
                console.warn("[Live2DManager] Pixi destroy notice:", e);
            }
            this.app = null;
        }

        this.model = null;
        this.container = null;
        this.isReady = false;
        this.isLoading = false;
    }
}

export default new Live2DManager();