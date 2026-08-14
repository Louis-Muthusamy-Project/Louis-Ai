const mongoose = require("mongoose");
const MemoryRepository = require("./MemoryRepository");

// Define Schemas
const MemorySchema = new mongoose.Schema({
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    importance: { type: Number, default: 5 },
    category: { type: String, default: "general" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const ProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.Mixed, default: {} },
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    goals: { type: [mongoose.Schema.Types.Mixed], default: [] },
    projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
    relationship: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeline: { type: [mongoose.Schema.Types.Mixed], default: [] }
});

// Since Yuna is single-user on desktop right now, we can use a single document for profile.
// In a multi-user environment, we would key by userId.
const SINGLE_USER_ID = "default_user";

class MongoMemoryRepository extends MemoryRepository {
    constructor() {
        super();
        this.MemoryModel = mongoose.models.Memory || mongoose.model("Memory", MemorySchema);
        this.ProfileModel = mongoose.models.Profile || mongoose.model("Profile", ProfileSchema);
    }

    async initialize() {
        const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yuna_ai";
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(uri);
            console.log("[MongoMemoryRepository] Connected to MongoDB.");
        }
    }

    async readMemories() {
        const docs = await this.MemoryModel.find({}).lean();
        return docs.map(doc => ({
            id: doc._id.toString(),
            text: doc.text,
            embedding: doc.embedding,
            importance: doc.importance,
            category: doc.category,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString()
        }));
    }

    async writeMemories(memories) {
        // To support the legacy array-overwrite behavior of FileStore, 
        // we can drop and insert, or intelligently upsert.
        // For canonical Phase 1 memory, it's better to manage them properly.
        // Since the current FileStore logic rewrites the entire array, we'll sync it here.
        await this.MemoryModel.deleteMany({});
        
        const bulk = memories.map(m => ({
            text: m.text,
            embedding: m.embedding,
            importance: m.importance,
            category: m.category,
            createdAt: m.createdAt || new Date(),
            updatedAt: m.updatedAt || new Date()
        }));
        
        if (bulk.length > 0) {
            await this.MemoryModel.insertMany(bulk);
        }
        return true;
    }

    async readProfile() {
        const doc = await this.ProfileModel.findOne({ _id: SINGLE_USER_ID }).lean();
        
        const defaultProfile = {
            user: { name: "User", birthday: null, hobbies: [], job: null },
            preferences: { likes: [], dislikes: [], speechSpeed: "normal", topicsOfInterest: [] },
            goals: [], projects: [], timeline: [],
            relationship: { level: 1, points: 0, firstInteraction: new Date().toISOString(), lastInteraction: new Date().toISOString(), interactionCount: 0 }
        };

        if (!doc) {
            return defaultProfile;
        }

        return {
            user: doc.user || defaultProfile.user,
            preferences: doc.preferences || defaultProfile.preferences,
            goals: doc.goals || defaultProfile.goals,
            projects: doc.projects || defaultProfile.projects,
            relationship: doc.relationship || defaultProfile.relationship,
            timeline: doc.timeline || defaultProfile.timeline
        };
    }

    async writeProfile(profile) {
        await this.ProfileModel.findOneAndUpdate(
            { _id: SINGLE_USER_ID },
            {
                user: profile.user,
                preferences: profile.preferences,
                goals: profile.goals,
                projects: profile.projects,
                relationship: profile.relationship,
                timeline: profile.timeline
            },
            { upsert: true, new: true }
        );
        return true;
    }
}

module.exports = MongoMemoryRepository;
