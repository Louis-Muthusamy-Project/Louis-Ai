const LEVELS = {
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
    SUCCESS: "SUCCESS",
    DEBUG: "DEBUG"
};

class Logger {

    timestamp() {
        return new Date().toISOString();
    }

    format(level, message) {
        return `[${this.timestamp()}] [${level}] ${message}`;
    }

    info(message, data = null) {
        console.log(this.format(LEVELS.INFO, message));

        if (data !== null) {
            console.log(data);
        }
    }

    success(message, data = null) {
        console.log(this.format(LEVELS.SUCCESS, message));

        if (data !== null) {
            console.log(data);
        }
    }

    warn(message, data = null) {
        console.warn(this.format(LEVELS.WARN, message));

        if (data !== null) {
            console.warn(data);
        }
    }

    error(message, error = null) {
        console.error(this.format(LEVELS.ERROR, message));

        if (error) {
            if (error.stack) {
                console.error(error.stack);
            } else {
                console.error(error);
            }
        }
    }

    debug(message, data = null) {
        if (process.env.NODE_ENV !== "development") {
            return;
        }

        console.log(this.format(LEVELS.DEBUG, message));

        if (data !== null) {
            console.log(data);
        }
    }

}

module.exports = new Logger();