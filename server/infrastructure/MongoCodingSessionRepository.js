const CodingSessionRepository = require("./CodingSessionRepository");
const CodingSessionModel = require("../models/CodingSession");

class MongoCodingSessionRepository extends CodingSessionRepository {
    async save(record) {
        await CodingSessionModel.findOneAndUpdate(
            { sessionId: record.sessionId },
            { $set: record },
            { upsert: true, new: true }
        );
        return record;
    }

    async get(sessionId) {
        const doc = await CodingSessionModel.findOne({ sessionId }).lean();
        return doc || null;
    }

    async listForUser(userId, { limit = 50 } = {}) {
        const docs = await CodingSessionModel
            .find({ userId })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .lean();
        return docs;
    }
}

module.exports = MongoCodingSessionRepository;
