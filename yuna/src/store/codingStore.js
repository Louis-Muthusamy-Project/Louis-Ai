import { create } from "zustand";

const MAX_ACTIVITY_ENTRIES = 300; // mirrors the backend's own cap - no unbounded React state growth
const MAX_TERMINAL_ENTRIES = 50;

const useCodingStore = create((set) => ({

    // ---- Workspace ---------------------------------------------------

    workspace: { configured: false, root: null },
    workspaceLoading: false,
    workspaceError: null,

    // Merges into the existing workspace object rather than replacing it -
    // callers pass only the fields they actually have (e.g. WorkspaceBar's
    // handleSetWorkspace only has {configured, root}, not `entries`), and
    // a partial update must never silently wipe out other already-known
    // workspace metadata.
    setWorkspace(patch) {
        set(state => ({ workspace: { ...state.workspace, ...patch }, workspaceError: null }));
    },

    setWorkspaceLoading(value) {
        set({ workspaceLoading: value });
    },

    setWorkspaceError(message) {
        set({ workspaceError: message });
    },

    // ---- File tree (lazily loaded per directory) ----------------------

    tree: {}, // relPath -> { entries: [{name,type,secret}], loading, error }
    expandedDirs: {}, // relPath -> true

    setDirEntries(relPath, entries) {
        set(state => ({
            tree: { ...state.tree, [relPath]: { entries, loading: false, error: null } }
        }));
    },

    setDirLoading(relPath, loading) {
        set(state => ({
            tree: { ...state.tree, [relPath]: { ...(state.tree[relPath] || { entries: [] }), loading } }
        }));
    },

    setDirError(relPath, error) {
        set(state => ({
            tree: { ...state.tree, [relPath]: { ...(state.tree[relPath] || { entries: [] }), loading: false, error } }
        }));
    },

    toggleExpanded(relPath) {
        set(state => ({
            expandedDirs: { ...state.expandedDirs, [relPath]: !state.expandedDirs[relPath] }
        }));
    },

    // ---- Editor tabs ---------------------------------------------------

    openTabs: [], // [{path, content, originalContent, dirty, loading, error}]
    activeTabPath: null,

    openTabLoading(path) {
        set(state => {
            if (state.openTabs.some(t => t.path === path)) {
                return { activeTabPath: path };
            }
            return {
                openTabs: [...state.openTabs, { path, content: "", originalContent: "", hash: null, dirty: false, loading: true, error: null }],
                activeTabPath: path
            };
        });
    },

    setTabContent(path, content, hash = null) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path
                ? { ...t, content, originalContent: content, hash, dirty: false, loading: false, error: null }
                : t)
        }));
    },

    setTabError(path, error) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path ? { ...t, loading: false, error } : t)
        }));
    },

    editTabContent(path, content) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path
                ? { ...t, content, dirty: content !== t.originalContent }
                : t)
        }));
    },

    markTabSaved(path, savedContent, hash = null) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path
                ? { ...t, content: savedContent, originalContent: savedContent, hash: hash ?? t.hash, dirty: false }
                : t)
        }));
    },

    closeTab(path) {
        set(state => {
            const openTabs = state.openTabs.filter(t => t.path !== path);
            const activeTabPath = state.activeTabPath === path
                ? (openTabs[openTabs.length - 1]?.path || null)
                : state.activeTabPath;
            return { openTabs, activeTabPath };
        });
    },

    setActiveTab(path) {
        set({ activeTabPath: path });
    },

    // Set by SearchPanel when a result is opened - CodeEditor watches this
    // and, once the target file's tab has actually finished loading,
    // scrolls Monaco to the matching line and clears it. Carries the path
    // alongside the line so a reveal meant for one file is never applied
    // to whatever tab happens to be active if the user switches tabs
    // before the file finishes loading.
    pendingReveal: null, // {path, line} | null

    setPendingReveal(path, line) {
        set({ pendingReveal: { path, line } });
    },

    clearPendingReveal() {
        set({ pendingReveal: null });
    },

    // ---- Providers -------------------------------------------------------

    providers: [],
    providersLoading: false,
    selectedProvider: null,
    // Real per-provider model lists (see CodingSocketService.listProviderModels /
    // CodingProviderRegistry.listModelsForProvider) - fetched lazily, once
    // per provider, the first time it becomes selected. Never a hardcoded
    // catalog: exactly what that provider reports for the user's own key.
    modelsByProvider: {}, // {[providerName]: {loading, models: [{id,label}], error}}
    selectedModel: null,

    setProviders(providers) {
        set(state => ({
            providers,
            providersLoading: false,
            // Keep the current selection if it's still enabled; otherwise
            // fall back to the first enabled provider, or nothing.
            selectedProvider: providers.find(p => p.name === state.selectedProvider && p.enabled)?.name
                || providers.find(p => p.enabled)?.name
                || null
        }));
    },

    setProvidersLoading(value) {
        set({ providersLoading: value });
    },

    setSelectedProvider(name) {
        set({ selectedProvider: name, selectedModel: null });
    },

    setModelsLoading(provider) {
        set(state => ({
            modelsByProvider: { ...state.modelsByProvider, [provider]: { loading: true, models: [], error: null } }
        }));
    },

    setModelsForProvider(provider, models) {
        set(state => ({
            modelsByProvider: { ...state.modelsByProvider, [provider]: { loading: false, models, error: null } }
        }));
    },

    setModelsError(provider, error) {
        set(state => ({
            modelsByProvider: { ...state.modelsByProvider, [provider]: { loading: false, models: [], error } }
        }));
    },

    setSelectedModel(id) {
        set({ selectedModel: id });
    },

    // ---- Live agent session ----------------------------------------------

    session: null, // {sessionId, state, task, provider, model, iterations, toolCalls, changedFiles, startedAt}
    activity: [],
    pendingApproval: null,

    startSession({ sessionId, task, provider, model }) {
        set({
            session: { sessionId, state: "RUNNING", task, provider, model, iterations: 0, toolCalls: 0, changedFiles: [], startedAt: Date.now() },
            activity: [],
            pendingApproval: null
        });
    },

    appendActivity(entry) {
        set(state => {
            const activity = [...state.activity, { ...entry, at: Date.now() }];
            return { activity: activity.length > MAX_ACTIVITY_ENTRIES ? activity.slice(activity.length - MAX_ACTIVITY_ENTRIES) : activity };
        });
    },

    patchSession(patch) {
        set(state => ({ session: state.session ? { ...state.session, ...patch } : state.session }));
    },

    incrementIteration() {
        set(state => ({ session: state.session ? { ...state.session, iterations: state.session.iterations + 1 } : state.session }));
    },

    addChangedFile(path) {
        set(state => {
            if (!state.session) return {};
            if (state.session.changedFiles.includes(path)) return {};
            return { session: { ...state.session, changedFiles: [...state.session.changedFiles, path] } };
        });
    },

    setPendingApproval(approval) {
        set({ pendingApproval: approval });
    },

    clearPendingApproval() {
        set({ pendingApproval: null });
    },

    finishSession(state, message) {
        set(prev => ({
            session: prev.session ? { ...prev.session, state, message } : prev.session,
            pendingApproval: null
        }));
    },

    // ---- Terminal ----------------------------------------------------------

    // Multiple independent terminal instances (like VS Code/Antigravity's
    // terminal list) - "agent" is the default, non-closable tab the real
    // CodingAgentRuntime's own tool-call terminal activity always lands in
    // (see CodingProvider.jsx's onTerminalStart, which never passes a
    // terminalId and so always targets this one) - additional tabs are
    // purely for the user's own manual commands, created/closed from the
    // Terminal panel itself.
    terminals: [{ id: "agent", label: "Agent", closable: false }],
    activeTerminalId: "agent",

    addTerminal() {
        set(state => {
            const n = state.terminals.filter(t => t.id !== "agent").length + 1;
            const id = `terminal-${Date.now()}`;
            return {
                terminals: [...state.terminals, { id, label: `Terminal ${n}`, closable: true }],
                activeTerminalId: id
            };
        });
    },

    closeTerminal(id) {
        set(state => {
            if (id === "agent") return state; // the agent's own tab is never closable
            const terminals = state.terminals.filter(t => t.id !== id);
            const terminalHistory = state.terminalHistory.filter(e => e.terminalId !== id);
            const activeTerminalId = state.activeTerminalId === id
                ? terminals[terminals.length - 1].id
                : state.activeTerminalId;
            return { terminals, terminalHistory, activeTerminalId };
        });
    },

    setActiveTerminal(id) {
        set({ activeTerminalId: id });
    },

    terminalHistory: [], // [{id, terminalId, command, stdout, stderr, exitCode, running, startedAt}]

    startTerminalEntry(id, command, terminalId = "agent") {
        set(state => {
            const entry = { id, terminalId, command, stdout: "", stderr: "", exitCode: null, running: true, startedAt: Date.now() };
            const history = [...state.terminalHistory, entry];
            return { terminalHistory: history.length > MAX_TERMINAL_ENTRIES ? history.slice(history.length - MAX_TERMINAL_ENTRIES) : history };
        });
    },

    appendTerminalOutput(id, { stdout, stderr }) {
        set(state => ({
            terminalHistory: state.terminalHistory.map(e => e.id === id
                ? { ...e, stdout: stdout ?? e.stdout, stderr: stderr ?? e.stderr }
                : e)
        }));
    },

    completeTerminalEntry(id, { exitCode, success, timedOut }) {
        set(state => ({
            terminalHistory: state.terminalHistory.map(e => e.id === id
                ? { ...e, exitCode, success, timedOut, running: false }
                : e)
        }));
    },

    // ---- Git ---------------------------------------------------------------

    gitStatus: null,
    gitDiff: null,
    gitLog: null,
    gitAvailable: true, // false once a NOT_A_REPO response is seen

    setGitStatus(status) { set({ gitStatus: status }); },
    setGitDiff(diff) { set({ gitDiff: diff }); },
    setGitLog(log) { set({ gitLog: log }); },
    setGitAvailable(value) { set({ gitAvailable: value }); },

    // ---- Session history -------------------------------------------------

    sessionHistory: [],
    sessionHistoryLoading: false,

    setSessionHistory(sessions) {
        set({ sessionHistory: sessions, sessionHistoryLoading: false });
    },

    setSessionHistoryLoading(value) {
        set({ sessionHistoryLoading: value });
    },

    reset() {
        set({
            workspace: { configured: false, root: null },
            tree: {}, expandedDirs: {},
            openTabs: [], activeTabPath: null, pendingReveal: null,
            session: null, activity: [], pendingApproval: null,
            terminalHistory: [],
            terminals: [{ id: "agent", label: "Agent", closable: false }], activeTerminalId: "agent",
            gitStatus: null, gitDiff: null, gitLog: null
        });
    }

}));

export default useCodingStore;
