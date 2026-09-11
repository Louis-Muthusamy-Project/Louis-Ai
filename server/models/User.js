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
        },
        role: {
            type: String,
            enum: ["user", "super_admin"],
            default: "user",
            index: true
        },
        status: {
            type: String,
            enum: ["active", "disabled"],
            default: "active"
        },
        features: {
            chat: { type: Boolean, default: true },
            character: { type: Boolean, default: true },
            coding: { type: Boolean, default: true }
        },
        lastLoginAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
