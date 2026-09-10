/**
 * Never let a child process spawned for the coding agent/UI (terminal
 * commands, git) inherit Yuna's own server secrets - GEMINI_API_KEY,
 * OPENAI_API_KEY, ANTHROPIC_API_KEY, JWT_SECRET, etc. This matters even
 * though the process being run (a shell command, or plain git) doesn't
 * itself echo the environment back: a malicious or compromised git hook
 * script (e.g. .git/hooks/post-commit) planted in the workspace would
 * otherwise have access to these secrets via its inherited environment.
 *
 * Only a conservative allowlist of harmless environment basics a normal
 * shell/npm/git command actually needs is passed through.
 */
const ALLOWLIST_PREFIXES = ["PATH", "HOME", "USERPROFILE", "APPDATA", "TEMP", "TMP", "SHELL", "LANG", "SYSTEMROOT", "WINDIR", "NODE_", "NPM_", "PNPM_", "YARN_"];

function scrubEnv(sourceEnv) {
    const scrubbed = {};
    for (const [key, value] of Object.entries(sourceEnv)) {
        if (ALLOWLIST_PREFIXES.some((prefix) => key.toUpperCase().startsWith(prefix))) {
            scrubbed[key] = value;
        }
    }
    return scrubbed;
}

module.exports = { scrubEnv };
