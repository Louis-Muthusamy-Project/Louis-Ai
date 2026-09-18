const express = require("express");

const router = express.Router();

const providerCredentialService = require("../services/providerCredentialService");

// Mounted behind requireAuth in config/server.js, so req.user is always
// the authenticated identity - never trust a userId from body/query here.
//
// CRITICAL: no response on this router ever includes a decrypted or
// plaintext API key. listStatus/getStatus/setApiKey/removeApiKey/
// setModels all return providerCredentialService's status shape, which
// only ever contains hasKey/maskedKey/enabled/models - see
// providerCredentialService.js's _toStatus().

const SUPPORTED = providerCredentialService.SUPPORTED_PROVIDERS;

function requireValidProvider(req, res, next) {
    if (!SUPPORTED.includes(req.params.provider)) {
        return res.status(400).json({ success: false, message: `Unknown provider "${req.params.provider}".` });
    }
    next();
}

// GET /api/settings/providers - status for every provider (Gemini/OpenAI/Claude)
router.get("/", (req, res) => {
    res.json({ success: true, providers: providerCredentialService.listStatus(req.user.id) });
});

// GET /api/settings/providers/:provider - status for one provider
router.get("/:provider", requireValidProvider, (req, res) => {
    res.json({ success: true, provider: providerCredentialService.getStatus(req.user.id, req.params.provider) });
});

// PUT /api/settings/providers/:provider/key - set/replace the API key
router.put("/:provider/key", requireValidProvider, async (req, res) => {
    const { apiKey } = req.body || {};
    if (typeof apiKey !== "string" || !apiKey.trim()) {
        return res.status(400).json({ success: false, message: "apiKey is required." });
    }
    try {
        const provider = await providerCredentialService.setApiKey(req.user.id, req.params.provider, apiKey);
        res.json({ success: true, provider });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// DELETE /api/settings/providers/:provider/key - remove the API key
router.delete("/:provider/key", requireValidProvider, async (req, res) => {
    const provider = await providerCredentialService.removeApiKey(req.user.id, req.params.provider);
    res.json({ success: true, provider });
});

// PUT /api/settings/providers/:provider/models - update per-capability models
router.put("/:provider/models", requireValidProvider, async (req, res) => {
    const { models } = req.body || {};
    if (!models || typeof models !== "object") {
        return res.status(400).json({ success: false, message: "models object is required." });
    }
    const provider = await providerCredentialService.setModels(req.user.id, req.params.provider, models);
    res.json({ success: true, provider });
});

// PUT /api/settings/providers/:provider/enabled - enable/disable a configured provider
router.put("/:provider/enabled", requireValidProvider, async (req, res) => {
    const { enabled } = req.body || {};
    try {
        const provider = await providerCredentialService.setEnabled(req.user.id, req.params.provider, !!enabled);
        res.json({ success: true, provider });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
