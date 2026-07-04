/**
 * ==========================================
 * Environment Validator
 * ------------------------------------------
 * Validates required environment variables
 * before starting the server.
 * ==========================================
 */

const REQUIRED_ENV = [
    "GEMINI_API_KEY"
];

function validateEnvironment() {

    const missing = REQUIRED_ENV.filter(name => {

        const value = process.env[name];

        return (
            value === undefined ||
            value === null ||
            value.toString().trim() === ""
        );

    });

    if (missing.length > 0) {

        console.error("");

        console.error("======================================");
        console.error("      YUNA CONFIGURATION ERROR");
        console.error("======================================");
        console.error("");

        console.error(
            "Missing Environment Variables:"
        );

        missing.forEach(name => {

            console.error(` • ${name}`);

        });

        console.error("");

        console.error(
            "Please update your .env file and restart the server."
        );

        console.error("");

        process.exit(1);

    }

}

module.exports = {

    validateEnvironment

};