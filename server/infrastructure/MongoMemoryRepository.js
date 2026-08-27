const mongoose = require("mongoose");
const MemoryRepository = require("./MemoryRepository");

// Define Schemas
const MemorySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    importance: { type: Number, default: 5 },
    category: { type: String, default: "general" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const ProfileSchema = new mongoose.Schema({
    // _id IS the userId - one profile document per user.
    user: { type: mongoose.Schema.Types.Mixed, default: {} },
    preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
    goals: { type: [mongoose.Schema.Types.Mixed], default: [] },
    projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
    relationship: { type: mongoose.Schema.Types.Mixed, default: {} },
    timeline: { type: [mongoose.Schema.Types.Mixed], default: [] }
});

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

    async readMemories(userId) {
        const docs = await this.MemoryModel.find({ userId }).lean();
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

    async writeMemories(userId, memories) {
        await this.MemoryModel.deleteMany({ userId });

        const bulk = memories.map(m => ({
            userId,
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

    async readProfile(userId) {
        const doc = await this.ProfileModel.findOne({ _id: userId }).lean();

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

    async writeProfile(userId, profile) {
        await this.ProfileModel.findOneAndUpdate(
            { _id: userId },
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