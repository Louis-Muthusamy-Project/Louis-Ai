/**
 * ==========================================
 * Coding Tool Definitions
 * ------------------------------------------
 * One canonical list of tools the coding agent can call, described as
 * plain JSON Schema. Every provider adapter (GeminiCodingProvider now,
 * OpenAI/Claude later - see CodingModelProvider.js) converts this SAME
 * list into whatever wire format its SDK wants:
 *   - Gemini: FunctionDeclaration.parametersJsonSchema (used as-is)
 *   - OpenAI: tools[].function.parameters (same JSON Schema object)
 *   - Claude: tools[].input_schema (same JSON Schema object)
 * so the actual capability surface never has to be duplicated or drift
 * between providers - only the request/response envelope differs, and
 * that's the adapter's job, not this file's.
 *
 * `name` here is the tool name the model sees and must match one of the
 * `action` cases CodingAgentRuntime knows how to route to
 * CodingWorkspaceCapability (see CODING_TOOL_TO_CAPABILITY_ACTION below).
 * ==========================================
 */

const CODING_TOOLS = [
    {
        name: "workspace_inspect",
        description: "Get the configured workspace root and a top-level directory listing. Call this first to orient yourself.",
        parameters: { type: "object", properties: {}, required: [] }
    },
    {
        name: "workspace_list",
        description: "List files and directories at a path relative to the workspace root.",
        parameters: {
            type: "object",
            properties: { path: { type: "string", description: "Path relative to the workspace root. Defaults to the root itself." } },
            required: []
        }
    },
    {
        name: "workspace_search",
        description: "Search the workspace for a filename or file-content match. Use this before reading files blindly.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Text to search for in filenames and file contents." },
                includeContent: { type: "boolean", description: "Whether to also search file contents, not just filenames. Defaults to true." }
            },
            required: ["query"]
        }
    },
    {
        name: "file_read",
        description: "Read the full text content of a file relative to the workspace root.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path relative to the workspace root." },
                acknowledgeSecret: { type: "boolean", description: "Set true ONLY if you have an explicit, specific reason to read a file that looks like a secret (.env, private key, credentials file). Do not set this speculatively." }
            },
            required: ["path"]
        }
    },
    {
        name: "file_write",
        description: "Overwrite (or create) a file with the given full content, relative to the workspace root. This performs a real write to disk.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path relative to the workspace root." },
                content: { type: "string", description: "The full new content of the file." },
                acknowledgeSecret: { type: "boolean", description: "Set true ONLY if intentionally writing to a secret-looking filename." }
            },
            required: ["path", "content"]
        }
    },
    {
        name: "file_create",
        description: "Create a new file with the given content relative to the workspace root. Fails safely (returns created:false info) if content is omitted - use file_write to overwrite an existing file.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path relative to the workspace root." },
                content: { type: "string", description: "Initial file content." }
            },
            required: ["path", "content"]
        }
    },
    {
        name: "file_delete",
        description: "Delete a file relative to the workspace root. This is destructive - you MUST set confirmed:true, and you should only do this when the user's task clearly calls for removing the file.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path relative to the workspace root." },
                confirmed: { type: "boolean", description: "Must be true to actually delete. Deletion is refused otherwise." }
            },
            required: ["path", "confirmed"]
        }
    },
    {
        name: "file_rename",
        description: "Rename or move a file within the workspace.",
        parameters: {
            type: "object",
            properties: {
                from: { type: "string", description: "Current path relative to the workspace root." },
                to: { type: "string", description: "New path relative to the workspace root." }
            },
            required: ["from", "to"]
        }
    },
    {
        name: "terminal_run",
        description: "Run a shell command inside the workspace (e.g. npm test, npm run build, node script.js). Returns real stdout/stderr/exitCode. Destructive commands (rm -rf, git reset --hard, git push --force, etc.) require confirmed:true and will otherwise be refused.",
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to run." },
                cwd: { type: "string", description: "Working directory relative to the workspace root. Defaults to the workspace root." },
                confirmed: { type: "boolean", description: "Set true to allow a destructive command that was refused without confirmation." }
            },
            required: ["command"]
        }
    },
    {
        name: "test_run",
        description: "Run the project's test command (e.g. npm test). This is the same execution path as terminal_run - use it specifically when your intent is to run tests, so activity logs read clearly.",
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", description: "The test command to run, e.g. \"npm test\"." },
                cwd: { type: "string", description: "Working directory relative to the workspace root." }
            },
            required: ["command"]
        }
    },
    {
        name: "git_status",
        description: "Show which files are modified/staged/untracked.",
        parameters: { type: "object", properties: { cwd: { type: "string" } }, required: [] }
    },
    {
        name: "git_diff",
        description: "Show the diff of unstaged (or staged) changes, optionally for one file.",
        parameters: {
            type: "object",
            properties: {
                file: { type: "string", description: "Limit the diff to one file, relative to the workspace root." },
                staged: { type: "boolean", description: "Show staged changes instead of unstaged. Defaults to false." },
                cwd: { type: "string" }
            },
            required: []
        }
    },
    {
        name: "git_log",
        description: "Show recent commit history.",
        parameters: { type: "object", properties: { limit: { type: "number" }, cwd: { type: "string" } }, required: [] }
    },
    {
        name: "git_stage",
        description: "Stage one or more files for commit.",
        parameters: {
            type: "object",
            properties: { files: { type: "array", items: { type: "string" }, description: "File paths relative to the workspace root." }, cwd: { type: "string" } },
            required: ["files"]
        }
    },
    {
        name: "git_unstage",
        description: "Unstage one or more previously staged files.",
        parameters: {
            type: "object",
            properties: { files: { type: "array", items: { type: "string" } }, cwd: { type: "string" } },
            required: ["files"]
        }
    },
    {
        name: "git_commit",
        description: "Commit currently staged changes with the given message. Never pushes. Only commit when the user has actually asked you to, or clearly expects the change to be committed as part of the task.",
        parameters: {
            type: "object",
            properties: { message: { type: "string" }, cwd: { type: "string" } },
            required: ["message"]
        }
    }
];

// Maps a tool name (as presented to the model) to the CodingWorkspaceCapability
// action + how to shape its params from the model's function-call args.
const CODING_TOOL_TO_CAPABILITY_ACTION = {
    workspace_inspect: { action: "workspace.inspect", mapParams: () => ({}) },
    workspace_list: { action: "workspace.list", mapParams: (args) => ({ path: args.path }) },
    workspace_search: { action: "workspace.search", mapParams: (args) => ({ query: args.query, includeContent: args.includeContent }) },
    file_read: { action: "file.read", mapParams: (args) => ({ path: args.path, acknowledgeSecret: args.acknowledgeSecret }) },
    file_write: { action: "file.write", mapParams: (args) => ({ path: args.path, content: args.content, acknowledgeSecret: args.acknowledgeSecret }) },
    file_create: { action: "file.create", mapParams: (args) => ({ path: args.path, content: args.content }) },
    file_delete: { action: "file.delete", mapParams: (args) => ({ path: args.path, confirmed: args.confirmed }) },
    file_rename: { action: "file.rename", mapParams: (args) => ({ from: args.from, to: args.to }) },
    terminal_run: { action: "terminal.run", mapParams: (args) => ({ command: args.command, cwd: args.cwd, confirmed: args.confirmed }) },
    test_run: { action: "terminal.run", mapParams: (args) => ({ command: args.command, cwd: args.cwd }) },
    git_status: { action: "git.status", mapParams: (args) => ({ cwd: args.cwd }) },
    git_diff: { action: "git.diff", mapParams: (args) => ({ file: args.file, staged: args.staged, cwd: args.cwd }) },
    git_log: { action: "git.log", mapParams: (args) => ({ limit: args.limit, cwd: args.cwd }) },
    git_stage: { action: "git.stage", mapParams: (args) => ({ files: args.files, cwd: args.cwd }) },
    git_unstage: { action: "git.unstage", mapParams: (args) => ({ files: args.files, cwd: args.cwd }) },
    git_commit: { action: "git.commit", mapParams: (args) => ({ message: args.message, cwd: args.cwd }) }
};

// Tool names whose successful execution represents a real filesystem change
// worth telling the frontend about explicitly (coding:file:changed).
const FILE_MUTATING_TOOLS = new Set(["file_write", "file_create", "file_delete", "file_rename"]);
const TERMINAL_TOOLS = new Set(["terminal_run", "test_run"]);

module.exports = { CODING_TOOLS, CODING_TOOL_TO_CAPABILITY_ACTION, FILE_MUTATING_TOOLS, TERMINAL_TOOLS };
