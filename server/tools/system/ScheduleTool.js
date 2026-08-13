const BaseTool = require("../BaseTool");
const scheduleCapability = require("../../capabilities/ScheduleCapability");

class ScheduleTool extends BaseTool {
    constructor() {
        super(
            "schedule",
            "Manages tasks, timers, reminders, and recurring schedules. Actions include: setTimer, setReminder, setRecurring, listTasks, cancelTask."
        );
    }

    async execute(args) {
        const { action, params = {} } = args;

        try {
            switch (action) {
                case "setTimer":
                    return await scheduleCapability.setTimer(params.durationInSeconds, params.message);
                case "setReminder":
                    return await scheduleCapability.setReminder(params.dateString, params.message);
                case "setRecurring":
                    return await scheduleCapability.setRecurring(params.cronExpression, params.message);
                case "listTasks":
                    return scheduleCapability.listTasks();
                case "cancelTask":
                    return await scheduleCapability.cancelTask(params.id);
                default:
                    return { success: false, message: `Unknown schedule action: ${action}` };
            }
        } catch (error) {
            return { success: false, message: `Schedule action failed: ${error.message}` };
        }
    }
}

module.exports = new ScheduleTool();
