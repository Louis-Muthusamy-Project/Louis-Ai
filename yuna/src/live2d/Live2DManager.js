import * as PIXI from "pixi.js";

class Live2DManager {

    constructor() {

        this.app = null;
        this.model = null;

    }

    async initialize(canvas) {

        this.app = new PIXI.Application({

            view: canvas,

            resizeTo: canvas.parentElement,

            backgroundAlpha: 0,

            antialias: true

        });

    }

    async loadModel() {

        console.log("Live2D model loading...");

        /*
            Next step:

            Cubism Model

            ↓

            this.model

            ↓

            stage.addChild(model)
        */

    }

}

export default new Live2DManager();