const express = require("express");

const { listUsers, updateUserModules, deleteUser } = require("../controllers/admin.controller");
const { requireSuperAdmin } = require("../middleware/featureMiddleware");

const router = express.Router();

// NOTE: this router is mounted behind `requireAuth` in config/server.js,
// so req.user is always the server-verified authenticated user here.
// requireSuperAdmin then rejects anyone whose DB role isn't super_admin -
// this can never be bypassed by a client-supplied role/email/header.
router.use(requireSuperAdmin);

router.get("/users", listUsers);
router.patch("/users/:userId/modules", updateUserModules);
router.delete("/users/:userId", deleteUser);

module.exports = router;
