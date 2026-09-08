import { create } from "zustand";

const MAX_ACTIVITY_ENTRIES = 300; // mirrors the backend's own cap - no unbounded React state growth
const MAX_TERMINAL_ENTRIES = 50;

const useCodingStore = create((set) => ({

    // ---- Workspace ---------------------------------------------------

    workspace: { configured: false, root: null },
    workspaceLoading: false,
    workspaceError: null,

    setWorkspace(workspace) {
        set({ workspace, workspaceError: null });
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

    openTabs: [], // [{path, content, originalContent, dirty, loading, error, externalConflict}]
    activeTabPath: null,

    openTabLoading(path) {
        set(state => {
            if (state.openTabs.some(t => t.path === path)) {
                return { activeTabPath: path };
            }
            return {
                openTabs: [...state.openTabs, { path, content: "", originalContent: "", hash: null, dirty: false, loading: true, error: null, externalConflict: false }],
                activeTabPath: path
            };
        });
    },

    setTabContent(path, content, hash = null) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path
                ? { ...t, content, originalContent: content, hash, dirty: false, loading: false, error: null, externalConflict: false }
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
                ? { ...t, content: savedContent, originalContent: savedContent, hash: hash ?? t.hash, dirty: false, externalConflict: false }
                : t)
        }));
    },

    markTabConflict(path) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path ? { ...t, externalConflict: true } : t)
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

    // A file this agent (or another tab) just changed on disk - if it's
    // open and NOT dirty, the content is stale; mark it so the editor can
    // show a reload affordance instead of silently going stale.
    markFileChangedExternally(path) {
        set(state => ({
            openTabs: state.openTabs.map(t => t.path === path && !t.dirty
                ? { ...t, externalConflict: true }
                : t)
        }));
    },

    // ---- Providers -------------------------------------------------------

    providers: [],
    providersLoading: false,
    selectedProvider: null,

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
        set({ selectedProvider: name });
    },

    // ---- Live agent session ----------------------------------------------

    session: null, // {sessionId, state, task, provider, iterations, toolCalls, changedFiles, startedAt}
    activity: [],
    pendingApproval: null,

    startSession({ sessionId, task, provider }) {
        set({
            session: { sessionId, state: "RUNNING", task, provider, iterations: 0, toolCalls: 0, changedFiles: [], startedAt: Date.now() },
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

    terminalHistory: [], // [{id, command, stdout, stderr, exitCode, running, startedAt}]

    startTerminalEntry(id, command) {
        set(state => {
            const entry = { id, command, stdout: "", stderr: "", exitCode: null, running: true, startedAt: Date.now() };
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
            openTabs: [], activeTabPath: null,
            session: null, activity: [], pendingApproval: null,
            terminalHistory: [],
            gitStatus: null, gitDiff: null, gitLog: null
        });
    }

}));

export default useCodingStore;
