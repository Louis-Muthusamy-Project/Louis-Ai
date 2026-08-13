/**
 * ============================================================================
 * Live2DCoordinator
 * ============================================================================
 * Central hub synchronizing all Live2D sub-controllers with:
 * - EmotionEngine (9-axis cognitive state & primary emotions)
 * - AudioQueue & Web Audio API (real-time voice lip-sync)
 * - Chat Store (thinking, typing, streaming text, speech state)
 * - User interactions (pointer tracking, tap body reactions)
 */

import { BlinkController } from "./BlinkController";
import { BreathingController } from "./BreathingController";
import { EyeTrackingController } from "./EyeTrackingController";
import { MouseTrackingController } from "./MouseTrackingController";
import { HeadRotationController } from "./HeadRotationController";
import { ExpressionEngine } from "./ExpressionEngine";
import { MotionController } from "./MotionController";
import { LipSyncEngine } from "./LipSyncEngine";
import { IdleMotionManager } from "./IdleMotionManager";
import { PhysicsController } from "./PhysicsController";

export class Live2DCoordinator {
    constructor() {
        this.model = null;

        // Instantiate sub-controllers
        this.blink = new BlinkController();
        this.breathing = new BreathingController();
        this.eyeTracking = new EyeTrackingController();
        this.mouseTracking = new MouseTrackingController();
        this.headRotation = new HeadRotationController();
        this.expression = new ExpressionEngine();
        this.motion = new MotionController();
        this.lipSync = new LipSyncEngine();
        this.idleMotion = new IdleMotionManager(this.motion);
        this.physics = new PhysicsController();

        // State mirrors
        this.emotionState = {
            primary: "neutral",
            joy: 0.5,
            energy: 0.5,
            stress: 0.1,
            curiosity: 0.5,
            attachment: 0.3,
            confidence: 0.5,
        };
        this.isSpeaking = false;
        this.isThinking = false;
    }

    /**
     * Bind Live2D model instance to coordinator and all sub-controllers.
     * @param {object} model - pixi-live2d-display model instance
     */
    setModel(model) {
        this.model = model;
        this.motion.setModel(model);
        this.physics.setModel(model);
        this.idleMotion.setMotionController(this.motion);

        if (model && model.internalModel) {
            // Disable built-in random blink and eye focus so our custom high-fidelity
            // controllers take full organic control without jitter or fighting
            if (model.internalModel.eyeBlink) {
                model.internalModel.eyeBlink = null;
            }
        }
    }

    /**
     * Connect Web Audio Analyser for real-time lip-sync.
     * @param {AnalyserNode} analyserNode
     */
    setAudioAnalyser(analyserNode) {
        this.lipSync.setAnalyser(analyserNode);
    }

    /**
     * Update current emotion state from EmotionEngine.
     * @param {object} emotionState
     */
    setEmotionState(emotionState) {
        if (!emotionState) return;
        this.emotionState = { ...this.emotionState, ...emotionState };
        if (emotionState.primary) {
            this.expression.setEmotion(emotionState.primary);
        }
    }

    /**
     * Set speaking state from Voice / Chat systems.
     * @param {boolean} speaking
     */
    setSpeaking(speaking) {
        this.isSpeaking = speaking;
        if (speaking) {
            this.lipSync.start();
        } else {
            this.lipSync.stop();
        }
    }

    /**
     * Set thinking state.
     * @param {boolean} thinking
     */
    setThinking(thinking) {
        this.isThinking = thinking;
        if (thinking) {
            this.expression.setEmotion("thinking");
        } else if (this.emotionState.primary) {
            this.expression.setEmotion(this.emotionState.primary);
        }
    }

    /**
     * Handle user tap on character body.
     */
    handleTapBody() {
        this.motion.tapBody();
        // Playful blink
        this.blink.triggerBlink(true);
    }

    /**
     * Handle pointer movement.
     */
    handlePointerMove(clientX, clientY, bounds) {
        this.mouseTracking.handlePointerMove(clientX, clientY, bounds);
    }

    /**
     * Handle pointer leave.
     */
    handlePointerLeave() {
        this.mouseTracking.handlePointerLeave();
    }

    /**
     * Master tick loop invoked every frame by Pixi Ticker.
     * @param {number} deltaSeconds - Delta time in seconds
     */
    tick(deltaSeconds) {
        if (!this.model || !this.model.internalModel) return;

        const deltaMs = deltaSeconds * 1000;
        const coreModel = this.model.internalModel.coreModel;
        if (!coreModel) return;

        // ── 1. Update Mouse Tracking ─────────────────────────────────────────
        const mouse = this.mouseTracking.update(deltaSeconds);

        // ── 2. Update Eye Tracking (Micro-saccades & Look-at) ─────────────────
        this.eyeTracking.setTarget(mouse.x, mouse.y);
        const eyes = this.eyeTracking.update(deltaSeconds, this.emotionState, this.isSpeaking);

        // ── 3. Update Head & Body Rotation ───────────────────────────────────
        const head = this.headRotation.update(deltaSeconds, mouse, this.emotionState, this.isSpeaking);

        // ── 4. Update Breathing & Thoracic Pulse ─────────────────────────────
        const breathing = this.breathing.update(deltaSeconds, this.emotionState);

        // ── 5. Update Ambient Idle Motion & Drift ────────────────────────────
        const idle = this.idleMotion.update(deltaSeconds, this.emotionState, this.isSpeaking);

        // ── 6. Update Blink Cycle ────────────────────────────────────────────
        const blink = this.blink.update(deltaMs, this.emotionState);

        // ── 7. Update Expression Blending ────────────────────────────────────
        const expr = this.expression.update(deltaMs, this.emotionState);

        // ── 8. Update Lip Sync ───────────────────────────────────────────────
        const lip = this.lipSync.update(deltaSeconds, this.isSpeaking);

        // ── 9. Update Physics Integration ────────────────────────────────────
        this.physics.update(deltaSeconds, head, this.emotionState);

        // ── 10. Write Final Parameters to Cubism Core Model ──────────────────
        this._writeParameter(coreModel, "ParamAngleX", head.angleX + idle.driftAngleX);
        this._writeParameter(coreModel, "ParamAngleY", head.angleY + idle.driftAngleY);
        this._writeParameter(coreModel, "ParamAngleZ", head.angleZ + idle.driftAngleZ);

        this._writeParameter(coreModel, "ParamBodyAngleX", head.bodyAngleX);
        this._writeParameter(coreModel, "ParamBodyAngleY", head.bodyAngleY);
        this._writeParameter(coreModel, "ParamBodyAngleZ", head.bodyAngleZ);

        this._writeParameter(coreModel, "ParamEyeBallX", eyes.eyeBallX);
        this._writeParameter(coreModel, "ParamEyeBallY", eyes.eyeBallY);

        this._writeParameter(coreModel, "ParamEyeLOpen", blink.eyeLOpen);
        this._writeParameter(coreModel, "ParamEyeROpen", blink.eyeROpen);

        this._writeParameter(coreModel, "ParamEyeLSmile", expr.eyeLSmile);
        this._writeParameter(coreModel, "ParamEyeRSmile", expr.eyeRSmile);

        this._writeParameter(coreModel, "ParamBrowLY", expr.browLY);
        this._writeParameter(coreModel, "ParamBrowRY", expr.browRY);
        this._writeParameter(coreModel, "ParamBrowLX", expr.browLX);
        this._writeParameter(coreModel, "ParamBrowRX", expr.browRX);
        this._writeParameter(coreModel, "ParamBrowLAngle", expr.browLAngle);
        this._writeParameter(coreModel, "ParamBrowRAngle", expr.browRAngle);
        this._writeParameter(coreModel, "ParamBrowLForm", expr.browLForm);
        this._writeParameter(coreModel, "ParamBrowRForm", expr.browRForm);

        this._writeParameter(coreModel, "ParamMouthOpenY", lip.mouthOpenY);
        this._writeParameter(coreModel, "ParamMouthForm", expr.mouthForm + lip.mouthForm * 0.4);

        this._writeParameter(coreModel, "ParamBreath", breathing.breath);
        this._writeParameter(coreModel, "ParamShoulder", breathing.shoulder);

        this._writeParameter(coreModel, "ParamCheek", expr.cheek);
    }

    _writeParameter(coreModel, paramId, value) {
        if (!coreModel) return;
        try {
            if (typeof coreModel.setParameterValueById === "function") {
                coreModel.setParameterValueById(paramId, value);
            } else if (typeof coreModel.setParamFloat === "function") {
                coreModel.setParamFloat(paramId, value);
            }
        } catch {
            // Non-critical parameter mismatch ignore
        }
    }
}
