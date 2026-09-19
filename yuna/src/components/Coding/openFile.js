import CodingSocketService from "../../services/codingSocketService";
import useCodingStore from "../../store/codingStore";

/**
 * Opens a file in a Monaco tab via the real backend (file.read) - the
 * single place this logic lives, used by both FileExplorer (clicking a
 * tree node) and SearchPanel (clicking a result), so both go through the
 * exact same read/tab-open/error-handling path.
 *
 * @param {string} path Workspace-relative file path
 * @param {{ error?: (msg: string) => void }} [notify] Optional error notifier (e.g. antd message.error)
 * @param {number|null} [revealLine] If given, CodeEditor will scroll to and select this line once the file finishes loading (see codingStore's pendingReveal)
 */
export async function openCodingFile(path, notify = {}, revealLine = null) {
    useCodingStore.getState().openTabLoading(path);
    const result = await CodingSocketService.readFile(path);
    if (!result.success) {
        useCodingStore.getState().setTabError(path, result.message);
        notify.error?.(result.message || "Could not open file.");
        return false;
    }
    useCodingStore.getState().setTabContent(path, result.content, result.hash);
    if (revealLine) {
        useCodingStore.getState().setPendingReveal(path, revealLine);
    }
    return true;
}
