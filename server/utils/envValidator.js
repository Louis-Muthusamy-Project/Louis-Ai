

const REQUIRED_ENV = [
    "JWT_SECRET"
];

// Provider API keys (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
// are DELIBERATELY not required here. Per the API-key architecture, provider
// keys are never a boot-time/env dependency - each user supplies their own
// key from Settings -> AI Providers, encrypted per-user in the database
// (see providerCredentialService.js). The app must boot cleanly with zero
// provider keys configured anywhere. JWT_SECRET remains required because it
// is genuine infrastructure (auth token signing), not a provider credential.

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