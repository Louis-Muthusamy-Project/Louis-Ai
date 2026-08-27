const mongoose = require("mongoose");

/**
 * ==========================================
 * User Model (Mongo)
 * ==========================================
 * Never expose `passwordHash` outside this layer -
 * MongoUserRepository/authService strip it before
 * returning a user object to controllers.
 */
const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        passwordHash: {
            type: String,
            required: true,
            select: false
        }
    },
    { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
