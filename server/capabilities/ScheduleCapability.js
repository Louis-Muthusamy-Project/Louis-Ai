const BaseCapability = require("./BaseCapability");

class ScheduleCapability extends BaseCapability {
    constructor() {
        super("schedule", "Scheduler for timers, recurring tasks, and reminders", {
            description: "Creates and manages timers, reminders, and recurring tasks for the requesting user.",
            permission: "user-data",
            riskLevel: "low",
            timeoutMs: 5000
        });
    }

    async initialize(kernel) {
        this.scheduleService = kernel.get("scheduleService");
    }

    /**
     * Entry point used by the agent/plan pipeline (AutomationAgent -> capability.execute).
     * `input.__ownerId` is injected by AgentCoordinator from the authenticated
     * socket/user identity - it is never supplied by the AI's own plan args,
     * so a prompt cannot forge a different owner.
     */
    async execute(input = {}) {
        const { action, params = {}, __ownerId } = input;
        if (!__ownerId) {
            return { success: false, message: "Schedule capability requires an authenticated owner." };
        }

        switch (action) {
            case "setTimer":
                return this.setTimer(__ownerId, params.durationInSeconds, params.message);
            case "setReminder":
                return this.setReminder(__ownerId, params.dateString, params.message);
            case "setRecurring":
                return this.setRecurring(__ownerId, params.cronExpression, params.message);
            case "listTasks":
                return this.listTasks(__ownerId);
            case "cancelTask":
                return this.cancelTask(__ownerId, params.id);
            default:
                return { success: false, message: `Unknown schedule action: ${action}` };
        }
    }

    async setTimer(ownerId, durationInSeconds, message) {
        const id = await this.scheduleService.addTimer(ownerId, durationInSeconds, message);
        return { success: true, message: `Timer set for ${durationInSeconds} seconds`, id };
    }

    async setReminder(ownerId, dateString, message) {
        const id = await this.scheduleService.addReminder(ownerId, dateString, message);
        return { success: true, message: `Reminder set for ${dateString}`, id };
    }

    async setRecurring(ownerId, cronExpression, message) {
        const id = await this.scheduleService.addRecurring(ownerId, cronExpression, message);
        return { success: true, message: `Recurring task set with cron '${cronExpression}'`, id };
    }

    listTasks(ownerId) {
        const tasks = this.scheduleService.listTasks(ownerId);
        return { success: true, data: tasks };
    }

    async cancelTask(ownerId, id) {
        await this.scheduleService.cancelTask(ownerId, id);
        return { success: true, message: `Task ${id} cancelled` };
    }
}

module.exports = new ScheduleCapability();
