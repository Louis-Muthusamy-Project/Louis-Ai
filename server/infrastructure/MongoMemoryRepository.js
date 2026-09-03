const mongoose = require("mongoose");
const MemoryRepository = require("./MemoryRepository");

// Define Schemas
const MemorySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    // Stable app-level identity (MemoryItem.id, set once at creation and
    // preserved across read/modify/write round trips) - independent of
    // Mongo's own auto _id. Needed so writeMemories can target/update/
    // delete individual documents instead of wiping the whole collection
    // and reinserting everything on every save (see writeMemories below).
    id: { type: String, index: true },
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
        this._locks = new Map(); // userId -> Promise chain, serializes writeMemories per user
    }

    /**
     * Standalone MongoDB (no replica set) doesn't support multi-document
     * transactions, so this doesn't try to use one. Instead: writes for the
     * same user are serialized in-process (closing the classic same-user
     * concurrent-write race), and writeMemories itself no longer wipes the
     * whole collection before reinserting (closing the "collection is
     * briefly empty / a crash mid-write loses everything" risk) - see
     * writeMemories below.
     */
    _withUserLock(userId, fn) {
        const previous = this._locks.get(userId) || Promise.resolve();
        const next = previous.then(fn, fn);
        this._locks.set(userId, next.catch(() => {}));
        return next;
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
            // Prefer the stable app-level id; fall back to Mongo's _id for
            // documents written before the `id` field existed.
            id: doc.id || doc._id.toString(),
            text: doc.text,
            embedding: doc.embedding,
            importance: doc.importance,
            category: doc.category,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString()
        }));
    }

    /**
     * Previously: deleteMany({userId}) followed by insertMany(bulk). That
     * has two real problems - (1) a window where the user has zero
     * memories persisted between the delete and the insert (a crash there
     * loses everything), and (2) two concurrent calls for the same user
     * (a realistic scenario: memoryService.cleanupMemories() is fired
     * without being awaited right after saveLongTermMemory()) can
     * interleave their delete/insert pairs and silently lose or duplicate
     * records.
     *
     * Fixed with per-document upserts/deletes via bulkWrite, targeted by
     * each memory's stable app-level `id` (never Mongo's own _id, which
     * only exists after insertion) - the collection is never fully wiped,
     * and unrelated documents are left untouched. Combined with the
     * per-user lock above, this closes the same-user race; different
     * users were already isolated by the `userId` filter and remain so
     * (also included directly in each op's filter as defense in depth).
     */
    async writeMemories(userId, memories) {
        return this._withUserLock(userId, async () => {
            const existingDocs = await this.MemoryModel.find({ userId }).select("_id id").lean();
            const existingByStableId = new Map(
                existingDocs.map(d => [d.id || d._id.toString(), d._id])
            );

            const ops = [];
            const keptStableIds = new Set();

            for (const m of memories) {
                const fields = {
                    userId,
                    id: m.id,
                    text: m.text,
                    embedding: m.embedding,
                    importance: m.importance,
                    category: m.category,
                    createdAt: m.createdAt || new Date(),
                    updatedAt: new Date()
                };

                const existingMongoId = m.id && existingByStableId.get(m.id);
                if (existingMongoId) {
                    keptStableIds.add(m.id);
                    ops.push({
                        updateOne: {
                            filter: { _id: existingMongoId, userId }, // userId here too - defense in depth
                            update: { $set: fields }
                        }
                    });
                } else {
                    ops.push({ insertOne: { document: fields } });
                }
            }

            for (const [stableId, mongoId] of existingByStableId.entries()) {
                if (!keptStableIds.has(stableId)) {
                    ops.push({ deleteOne: { filter: { _id: mongoId, userId } } });
                }
            }

            if (ops.length > 0) {
                await this.MemoryModel.bulkWrite(ops, { ordered: true });
            }
            return true;
        });
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