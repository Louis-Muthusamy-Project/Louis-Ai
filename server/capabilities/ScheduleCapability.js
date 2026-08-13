const BaseCapability = require("./BaseCapability");

class ScheduleCapability extends BaseCapability {
    constructor() {
        super("schedule", "Scheduler for timers, recurring tasks, and reminders");
    }

    async initialize(kernel) {
        this.scheduleService = kernel.get("scheduleService");
    }

    async execute(input) {
        return { success: true, message: "Scheduler capability active" };
    }

    async setTimer(durationInSeconds, message) {
        const id = await this.scheduleService.addTimer(durationInSeconds, message);
        return { success: true, message: `Timer set for ${durationInSeconds} seconds`, id };
    }

    async setReminder(dateString, message) {
        const id = await this.scheduleService.addReminder(dateString, message);
        return { success: true, message: `Reminder set for ${dateString}`, id };
    }

    async setRecurring(cronExpression, message) {
        const id = await this.scheduleService.addRecurring(cronExpression, message);
        return { success: true, message: `Recurring task set with cron '${cronExpression}'`, id };
    }

    listTasks() {
        const tasks = this.scheduleService.listTasks();
        return { success: true, data: tasks };
    }

    async cancelTask(id) {
        await this.scheduleService.cancelTask(id);
        return { success: true, message: `Task ${id} cancelled` };
    }
}

module.exports = new ScheduleCapability();
