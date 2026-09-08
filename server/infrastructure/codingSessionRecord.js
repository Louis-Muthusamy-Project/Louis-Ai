const MAX_ACTIVITY_ENTRIES = 300;
const MAX_HISTORY_BYTES = 2 * 1024 * 1024; // 2 MB - a very large agent conversation; guards against unbounded growth

/**
 * Builds a plain, JSON-safe record from a live session object for
 * persistence. Bounds the activity log (oldest entries dropped, newest
 * kept - the newest activity is what matters for resuming/viewing a
 * session) and defends against a pathologically large history by
 * refusing to persist history past a hard byte cap rather than silently
 * truncating valid JSON mid-structure (which would produce an
 * unparseable/corrupt resume point - failing the persistence write for
 * just the history field, while still recording state/activity/counts,
 * is safer than persisting something resume() can't actually use).
 */
function toSessionRecord(session, history) {
    const activity = session.activity.length > MAX_ACTIVITY_ENTRIES
        ? session.activity.slice(session.activity.length - MAX_ACTIVITY_ENTRIES)
        : session.activity;

    let serializedHistory = history;
    let historyTooLarge = false;
    try {
        const json = JSON.stringify(history);
        if (json && json.length > MAX_HISTORY_BYTES) {
            historyTooLarge = true;
            serializedHistory = null;
        }
    } catch {
        historyTooLarge = true;
        serializedHistory = null;
    }

    return {
        sessionId: session.sessionId,
        userId: session.userId,
        providerName: session.providerName,
        task: session.task,
        state: session.state,
        history: serializedHistory,
        historyTooLarge,
        finalText: session.finalText || "",
        message: session.message || "",
        iterations: session.iterations,
        toolCalls: session.toolCalls,
        changedFiles: [...session.changedFiles],
        activity,
        pendingApproval: session.pendingApproval,
        startedAt: session.startedAt,
        updatedAt: Date.now()
    };
}

module.exports = { toSessionRecord, MAX_ACTIVITY_ENTRIES, MAX_HISTORY_BYTES };
