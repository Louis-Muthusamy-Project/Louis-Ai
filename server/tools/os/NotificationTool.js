const BaseTool = require("../BaseTool");
const PermissionService = require("../../services/permissionService");
const notifier = require("node-notifier");

class NotificationTool extends BaseTool {
    constructor() {
        super(
            "Notification",
            "Send an OS-level notification to the user."
        );
    }

    async execute(args) {
        if (!PermissionService.check("notifications")) {
            return "Error: Notification permission is denied.";
        }

        const { title, message } = args;

        if (!title || !message) {
            return "Error: Both title and message are required.";
        }

        try {
            return new Promise((resolve) => {
                notifier.notify({
                    title: title,
                    message: message,
                    appID: "Yuna AI Companion" // Appears on Windows Toast
                }, (error) => {
                    if (error) {
                        resolve(`Failed to send notification: ${error.message}`);
                    } else {
                        resolve("Notification sent successfully.");
                    }
                });
            });
        } catch (error) {
            return `Error sending notification: ${error.message}`;
        }
    }

    schema() {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Title of the notification" },
                    message: { type: "string", description: "Body text of the notification" }
                },
                required: ["title", "message"]
            }
        };
    }
}

module.exports = new NotificationTool();
