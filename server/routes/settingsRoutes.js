const express = require("express");

const router = express.Router();

const SettingsService = require("../services/settingsService");

// Mounted behind requireAuth in config/server.js, so req.user is always
// the authenticated identity - never trust a userId from body/query here.

router.get("/", (req, res) => {
    res.json({
        success: true,
        settings: SettingsService.getSettings(req.user.id)
    });
});

router.put("/", (req, res) => {
    const settings = SettingsService.updateSettings(req.user.id, req.body);

    res.json({
        success: true,
        settings
    });
});

module.exports = router;
