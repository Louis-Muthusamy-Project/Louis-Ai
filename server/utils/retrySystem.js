/**
 * ==========================================
 * Yuna Retry System
 * ------------------------------------------
 * Handles generic execution retries with
 * exponential backoff capabilities.
 * ==========================================
 */
class RetrySystem {
    /**
     * Executes an asynchronous operation with retry attempts and exponential backoff.
     * @param {Function} asyncFn The asynchronous function to run
     * @param {Object} options Config parameters { maxAttempts, delay, factor, onRetry }
     */
    static async execute(asyncFn, options = {}) {
        const {
            maxAttempts = 3,
            delay = 1000,
            factor = 2,
            timeoutMs = 0,
            onRetry = null
        } = options;

        let attempt = 0;
        while (attempt < maxAttempts) {
            try {
                if (timeoutMs > 0) {
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
                    });
                    return await Promise.race([asyncFn(), timeoutPromise]);
                }
                return await asyncFn();
            } catch (error) {
                attempt++;
                if (attempt >= maxAttempts) {
                    throw error;
                }
                const backoffDelay = delay * Math.pow(factor, attempt - 1);
                console.warn(`[RetrySystem] Attempt ${attempt} failed. Retrying in ${backoffDelay}ms... Error: ${error.message}`);
                
                if (typeof onRetry === "function") {
                    try {
                        await onRetry(error, attempt, backoffDelay);
                    } catch (cbErr) {
                        console.error("[RetrySystem] Error in onRetry callback:", cbErr);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
}

module.exports = RetrySystem;
