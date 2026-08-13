const schedule = require("node-schedule");
const fs = require("fs").promises;
const path = require("path");

class ScheduleService {
    constructor(kernel) {
        this.kernel = kernel;
        this.dataPath = path.join(__dirname, "..", "data", "schedule.json");
        this.jobs = new Map(); // id -> node-schedule Job
        this.tasks = {};       // id -> task metadata
    }

    async initialize() {
        this.eventBus = this.kernel.get("eventBus");
        await this.loadTasks();
    }

    async loadTasks() {
        try {
            const data = await fs.readFile(this.dataPath, "utf8");
            this.tasks = JSON.parse(data);
            
            // Reschedule tasks that are still relevant
            const now = new Date();
            for (const [id, task] of Object.entries(this.tasks)) {
                if (task.type === "timer" || task.type === "reminder") {
                    const scheduledTime = new Date(task.time);
                    if (scheduledTime > now) {
                        this._scheduleJob(id, task, scheduledTime);
                    } else {
                        // Task is in the past, remove it
                        delete this.tasks[id];
                    }
                } else if (task.type === "recurring") {
                    this._scheduleJob(id, task, task.cron);
                }
            }
            await this.saveTasks();
        } catch (error) {
            // File might not exist yet
            this.tasks = {};
        }
    }

    async saveTasks() {
        await fs.writeFile(this.dataPath, JSON.stringify(this.tasks, null, 2), "utf8");
    }

    _scheduleJob(id, task, spec) {
        const job = schedule.scheduleJob(spec, () => {
            console.log(`[ScheduleService] Triggering task: ${id}`);
            
            this.eventBus.emit("scheduler:trigger", {
                taskId: id,
                message: task.message,
                type: task.type
            });

            // If not recurring, remove it
            if (task.type !== "recurring") {
                this.cancelTask(id);
            }
        });

        if (job) {
            this.jobs.set(id, job);
        }
    }

    async addTimer(durationInSeconds, message) {
        const id = `timer-${Date.now()}`;
        const time = new Date(Date.now() + durationInSeconds * 1000);
        
        const task = { type: "timer", message, time: time.toISOString() };
        this.tasks[id] = task;
        this._scheduleJob(id, task, time);
        await this.saveTasks();
        
        return id;
    }

    async addReminder(dateString, message) {
        const id = `reminder-${Date.now()}`;
        const time = new Date(dateString);
        
        if (isNaN(time.getTime()) || time <= new Date()) {
            throw new Error("Invalid or past date for reminder.");
        }

        const task = { type: "reminder", message, time: time.toISOString() };
        this.tasks[id] = task;
        this._scheduleJob(id, task, time);
        await this.saveTasks();
        
        return id;
    }

    async addRecurring(cronExpression, message) {
        const id = `recurring-${Date.now()}`;
        
        const task = { type: "recurring", message, cron: cronExpression };
        this.tasks[id] = task;
        this._scheduleJob(id, task, cronExpression);
        await this.saveTasks();
        
        return id;
    }

    listTasks() {
        return this.tasks;
    }

    async cancelTask(id) {
        if (this.jobs.has(id)) {
            this.jobs.get(id).cancel();
            this.jobs.delete(id);
        }
        if (this.tasks[id]) {
            delete this.tasks[id];
            await this.saveTasks();
        }
    }
}

module.exports = ScheduleService;
