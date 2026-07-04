const express = require("express");

const router = express.Router();

const SettingsService = require("../services/settingsService");

router.get("/", (req, res) => {

    res.json({

        success: true,

        settings: SettingsService.getSettings()

    });

});

router.put("/", (req, res) => {

    const settings =

        SettingsService.updateSettings(

            req.body

        );

    res.json({

        success: true,

        settings

    });

});

module.exports = router;