function extractMemory(userMessage) {
    const lower = userMessage.toLowerCase();

    // Name detection (simple version)
    if (lower.includes("my name is")) {
        const name = userMessage.split("my name is")[1]?.trim();
        if (name) {
            return {
                type: "name",
                value: name,
            };
        }
    }

    return null;
}

module.exports = {
    extractMemory,
};