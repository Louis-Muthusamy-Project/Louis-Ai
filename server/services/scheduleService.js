const schedule = require("node-schedule");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

const { sanitizeUserId } = require("../utils/idSanitize");

/**
 * ==========================================
 * ScheduleService
 * ------------------------------------------
 * Per-user timers/reminders/recurring tasks, mirroring the
 * per-user layout used by FileMemoryRepository/SettingsFileStore:
 * server/data/users/<userId>/schedule.json.
 *
 * Every task carries an `ownerId`. All read/create/cancel operations
 * require an ownerId and only ever touch that owner's tasks - one
 * user can never see, update, or cancel another user's schedule.
 *
 * Legacy (pre-isolation) global schedule.json is migrated in for
 * whichever user first touches their (previously nonexistent)
 * per-user file, then renamed to schedule.json.migrated so it is
 * never re-applied or handed to a second user.
 * ==========================================
 */
class ScheduleService {
    constructor(kernel) {
        this.kernel = kernel;
        this.dataRoot = path.join(__dirname, "..", "data", "users");
        this.legacyPath = path.join(__dirname, "..", "data", "schedule.json");
        this.jobs = new Map();  // taskId -> node-schedule Job
        this.tasks = new Map(); // taskId -> task metadata (task.ownerId is always set)
    }

    _userDir(ownerId) {
        return path.join(this.dataRoot, sanitizeUserId(ownerId));
    }

    _filePath(ownerId) {
        return path.join(this._userDir(ownerId), "schedule.json");
    }

    _ensureDirExists(filePath) {
        const dir = path.dirname(filePath);
        if (!fsSync.existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }
    }

    _requireOwnerId(ownerId) {
        if (!ownerId) {
            throw new Error("ScheduleService requires an authenticated ownerId.");
        }
    }

    async initialize() {
        this.eventBus = this.kernel.get("eventBus");
        await this._loadAllUsers();
    }

    /** Eager bulk load at boot: every user directory that has a schedule.json. */
    async _loadAllUsers() {
        try {
            if (!fsSync.existsSync(this.dataRoot)) return;
            const entries = await fs.readdir(this.dataRoot, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const ownerId = entry.name;
                await this._loadOwnerTasks(ownerId, { reschedule: true });
            }
        } catch (error) {
            console.error("[ScheduleService] Error loading existing schedules:", error.message);
        }
    }

    /** One-time, best-effort migration of the old global schedule file. */
    async _tryMigrateLegacy(ownerId, filePath) {
        try {
            if (fsSync.existsSync(this.legacyPath) && !fsSync.existsSync(filePath)) {
                this._ensureDirExists(filePath);
                await fs.copyFile(this.legacyPath, filePath);
                await fs.rename(this.legacyPath, `${this.legacyPath}.migrated`);
                console.log(`[ScheduleService] Migrated legacy global schedule.json to owner ${ownerId}`);
            }
        } catch (error) {
            console.error("[ScheduleService] Legacy schedule migration skipped:", error.message);
        }
    }

    /** Loads one owner's tasks from disk into the in-memory map (does not overwrite already-loaded tasks for other owners). */
    async _loadOwnerTasks(ownerId, { reschedule = false } = {}) {
        const filePath = this._filePath(ownerId);
        await this._tryMigrateLegacy(ownerId, filePath);

        let raw;
        try {
            raw = await fs.readFile(filePath, "utf8");
        } catch (error) {
            return; // No file yet for this owner - nothing to load.
        }

        let ownerTasks;
        try {
            ownerTasks = JSON.parse(raw);
        } catch (error) {
            console.error(`[ScheduleService] Corrupt schedule.json for owner ${ownerId}, ignoring:`, error.message);
            return;
        }

        const now = new Date();
        let changed = false;
        for (const [id, task] of Object.entries(ownerTasks)) {
            const owned = { ...task, ownerId };
            if (owned.type === "timer" || owned.type === "reminder") {
                const scheduledTime = new Date(owned.time);
                if (scheduledTime > now) {
                    this.tasks.set(id, owned);
                    if (reschedule) this._scheduleJob(id, owned, scheduledTime);
                } else {
                    changed = true; // Task is in the past - drop it, don't persist/reschedule it.
                }
            } else if (owned.type === "recurring") {
                this.tasks.set(id, owned);
                if (reschedule) this._scheduleJob(id, owned, owned.cron);
            }
        }

        if (changed) {
            await this._saveOwnerTasks(ownerId);
        }
    }

    /** Persists only this owner's tasks to their own file - never rewrites another user's data. */
    async _saveOwnerTasks(ownerId) {
        const ownerTasks = {};
        for (const [id, task] of this.tasks.entries()) {
            if (task.ownerId === ownerId) {
                const { ownerId: _drop, ...rest } = task;
                ownerTasks[id] = rest;
            }
        }
        const filePath = this._filePath(ownerId);
        this._ensureDirExists(filePath);
        await fs.writeFile(filePath, JSON.stringify(ownerTasks, null, 2), "utf8");
    }

    _scheduleJob(id, task, spec) {
        const job = schedule.scheduleJob(spec, () => {
            console.log(`[ScheduleService] Triggering task: ${id} (owner: ${task.ownerId})`);

            this.eventBus.emit("scheduler:trigger", {
                taskId: id,
                ownerId: task.ownerId,
                message: task.message,
                type: task.type
            });

            if (task.type !== "recurring") {
                this.cancelTask(task.ownerId, id).catch(() => {});
            }
        });

        if (job) {
            this.jobs.set(id, job);
        }
    }

    async addTimer(ownerId, durationInSeconds, message) {
        this._requireOwnerId(ownerId);
        // Ensure this owner's already-persisted tasks are loaded before we add to them,
        // in case this is the first call since boot for a user created after startup.
        if (![...this.tasks.values()].some(t => t.ownerId === ownerId)) {
            await this._loadOwnerTasks(ownerId, { reschedule: true });
        }

        const id = `timer-${Date.now()}`;
        const time = new Date(Date.now() + durationInSeconds * 1000);

        const task = { ownerId, type: "timer", message, time: time.toISOString() };
        this.tasks.set(id, task);
        this._scheduleJob(id, task, time);
        await this._saveOwnerTasks(ownerId);

        return id;
    }

    async addReminder(ownerId, dateString, message) {
        this._requireOwnerId(ownerId);

        const time = new Date(dateString);
        if (isNaN(time.getTime()) || time <= new Date()) {
            throw new Error("Invalid or past date for reminder.");
        }

        const id = `reminder-${Date.now()}`;
        const task = { ownerId, type: "reminder", message, time: time.toISOString() };
        this.tasks.set(id, task);
        this._scheduleJob(id, task, time);
        await this._saveOwnerTasks(ownerId);

        return id;
    }

    async addRecurring(ownerId, cronExpression, message) {
        this._requireOwnerId(ownerId);

        const id = `recurring-${Date.now()}`;
        const task = { ownerId, type: "recurring", message, cron: cronExpression };
        this.tasks.set(id, task);
        this._scheduleJob(id, task, cronExpression);
        await this._saveOwnerTasks(ownerId);

        return id;
    }

    /** Returns only the calling owner's tasks - never another user's. */
    listTasks(ownerId) {
        this._requireOwnerId(ownerId);
        const result = {};
        for (const [id, task] of this.tasks.entries()) {
            if (task.ownerId === ownerId) {
                const { ownerId: _drop, ...rest } = task;
                result[id] = rest;
            }
        }
        return result;
    }

    /** Cancels a task only if it belongs to the calling owner; otherwise a silent no-op (never reveals whether the id exists for someone else). */
    async cancelTask(ownerId, id) {
        this._requireOwnerId(ownerId);

        const task = this.tasks.get(id);
        if (!task || task.ownerId !== ownerId) {
            return; // Not found, or belongs to a different user - treat identically.
        }

        if (this.jobs.has(id)) {
            this.jobs.get(id).cancel();
            this.jobs.delete(id);
        }
        this.tasks.delete(id);
        await this._saveOwnerTasks(ownerId);
    }
}

module.exports = ScheduleService;
