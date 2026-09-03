const BaseTool = require("../BaseTool");
const scheduleCapability = require("../../capabilities/ScheduleCapability");

class ScheduleTool extends BaseTool {
    constructor() {
        super(
            "schedule",
            "Manages tasks, timers, reminders, and recurring schedules. Actions include: setTimer, setReminder, setRecurring, listTasks, cancelTask."
        );
    }

    // NOTE: this Tool is not currently reached by the live chat pipeline
    // (AutomationAgent calls capabilityRegistry.get("schedule").execute()
    // directly - see ScheduleCapability.js). Kept in sync with it for when
    // ToolManager-based dispatch is wired in, so it doesn't silently regress.
    async execute(args) {
        const { action, params = {}, ownerId } = args;

        if (!ownerId) {
            return { success: false, message: "Schedule tool requires an authenticated ownerId." };
        }

        try {
            switch (action) {
                case "setTimer":
                    return await scheduleCapability.setTimer(ownerId, params.durationInSeconds, params.message);
                case "setReminder":
                    return await scheduleCapability.setReminder(ownerId, params.dateString, params.message);
                case "setRecurring":
                    return await scheduleCapability.setRecurring(ownerId, params.cronExpression, params.message);
                case "listTasks":
                    return scheduleCapability.listTasks(ownerId);
                case "cancelTask":
                    return await scheduleCapability.cancelTask(ownerId, params.id);
                default:
                    return { success: false, message: `Unknown schedule action: ${action}` };
            }
        } catch (error) {
            return { success: false, message: `Schedule action failed: ${error.message}` };
        }
    }
}

module.exports = new ScheduleTool();
