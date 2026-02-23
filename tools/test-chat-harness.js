/**
 * Test Chat Harness — Injectable browser code for fast Playwright Test Chat eval.
 *
 * Instead of the 5-step snapshot-poll loop per test (~15-30s), this harness
 * injects into the MCS Test Chat page and uses MutationObserver to detect
 * bot responses in real time. Each test becomes a single browser_evaluate call (~3-8s).
 *
 * Usage (from mcs-eval skill):
 *   1. Get install script: node tools/test-chat-harness.js --emit-install
 *   2. Inject via:         browser_evaluate({ function: <output from step 1> })
 *   3. Per test:           browser_evaluate({ function: `() => window.__testChat.sendAndWait("question", 30000)` })
 *   4. Reset:              browser_evaluate({ function: `() => window.__testChat.reset()` })
 *
 * The harness auto-detects the Test Chat DOM structure (selectors adapt to MCS UI versions).
 */

'use strict';

/**
 * Returns a JavaScript string that, when evaluated in the browser via
 * browser_evaluate, installs window.__testChat with sendAndWait, reset,
 * getMessages, and a ready flag.
 */
function getInstallScript() {
    // This entire function body is serialized as a string for browser injection.
    // It must be self-contained — no external requires or closures.
    return `() => {
        // Avoid double-install
        if (window.__testChat && window.__testChat.ready) {
            return 'Test chat harness already installed';
        }

        // --- Selector candidates (MCS UI evolves; try multiple patterns) ---
        const SELECTORS = {
            chatInput: [
                'textarea[placeholder*="Ask"]',
                'textarea[placeholder*="ask"]',
                'textarea[placeholder*="Type"]',
                'textarea[placeholder*="type"]',
                '[role="textbox"][data-testid*="chat"]',
                '[role="textbox"]'
            ],
            sendButton: [
                'button[aria-label*="Send"]',
                'button[aria-label*="send"]',
                'button[data-testid*="send"]',
                'button[title*="Send"]'
            ],
            resetButton: [
                'button[aria-label*="Start new"]',
                'button[aria-label*="Reset"]',
                'button[aria-label*="New conversation"]',
                'button[aria-label*="start new"]',
                'button[title*="Start new"]',
                'button[title*="Reset"]'
            ],
            botMessage: [
                '[data-content="message"][data-role="bot"]',
                '[aria-label*="Bot said"]',
                '.webchat__bubble--from-bot',
                '[class*="botMessage"]'
            ],
            chatFeed: [
                '[role="log"]',
                '[data-testid*="chat-feed"]',
                '[class*="chatFeed"]',
                '[class*="message-list"]',
                '[role="main"]'
            ]
        };

        /**
         * Try multiple selectors, return the first matching element.
         */
        function findElement(selectorList) {
            for (const sel of selectorList) {
                const el = document.querySelector(sel);
                if (el) return el;
            }
            return null;
        }

        /**
         * Get all current bot messages in the chat feed.
         * Returns text-only objects (no DOM refs — must serialize across browser_evaluate).
         */
        function getBotMessages() {
            const messages = [];
            for (const sel of SELECTORS.botMessage) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    els.forEach(el => {
                        const text = el.innerText || el.textContent || '';
                        if (text.trim()) {
                            messages.push({ text: text.trim(), timestamp: Date.now() });
                        }
                    });
                    break;  // Use first matching selector pattern
                }
            }
            return messages;
        }

        /**
         * Set value on input/textarea using native setter to trigger React state.
         */
        function setNativeValue(element, value) {
            const proto = Object.getPrototypeOf(element);
            const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') ||
                               Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value') ||
                               Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

            if (descriptor && descriptor.set) {
                descriptor.set.call(element, value);
            } else {
                element.value = value;
            }

            // Dispatch events to trigger React/framework handlers
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        /**
         * Watch the DOM for a new bot message using MutationObserver + polling.
         * Waits until the response text stabilizes (no changes for 400ms) to handle streaming.
         */
        function watchForNewBotMessage(baselineCount, timeoutMs) {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                let resolved = false;
                let lastText = null;
                let stableTimer = null;
                const STABLE_MS = 400;  // Text must be unchanged for this long

                function cleanup() {
                    if (pollInterval) clearInterval(pollInterval);
                    if (observer) observer.disconnect();
                    if (stableTimer) clearTimeout(stableTimer);
                }

                function checkForResponse() {
                    if (resolved) return;
                    const current = getBotMessages();
                    if (current.length > baselineCount) {
                        const newText = current[current.length - 1].text;

                        // If text changed since last check, reset the stability timer
                        if (newText !== lastText) {
                            lastText = newText;
                            if (stableTimer) clearTimeout(stableTimer);
                            stableTimer = setTimeout(() => {
                                if (resolved) return;
                                resolved = true;
                                cleanup();
                                // Re-read to get final state
                                const final = getBotMessages();
                                resolve(final[final.length - 1].text);
                            }, STABLE_MS);
                        }
                    }
                }

                // Strategy 1: MutationObserver on the chat feed
                const feed = findElement(SELECTORS.chatFeed);
                let observer = null;

                if (feed) {
                    observer = new MutationObserver(() => checkForResponse());
                    observer.observe(feed, {
                        childList: true,
                        subtree: true,
                        characterData: true
                    });
                }

                // Strategy 2: Polling fallback (catches cases where Observer misses)
                const pollInterval = setInterval(() => {
                    if (resolved) {
                        cleanup();
                        return;
                    }
                    if (Date.now() - start > timeoutMs) {
                        resolved = true;
                        cleanup();
                        // One last check
                        const final = getBotMessages();
                        if (final.length > baselineCount) {
                            resolve(final[final.length - 1].text);
                        } else {
                            reject(new Error(
                                'Timeout: no bot response within ' + (timeoutMs / 1000) + 's. ' +
                                'Baseline messages: ' + baselineCount + ', current: ' + final.length
                            ));
                        }
                        return;
                    }
                    checkForResponse();
                }, 500);
            });
        }

        // --- Install the public API ---

        window.__testChat = {
            ready: true,

            /**
             * Send a message and wait for the bot's response.
             * @param {string} question - The message to send
             * @param {number} timeoutMs - Max wait time (default 60s)
             * @returns {Promise<{response: string, elapsed: number}>}
             */
            async sendAndWait(question, timeoutMs = 60000) {
                const start = Date.now();

                // 1. Find chat input
                const input = findElement(SELECTORS.chatInput);
                if (!input) {
                    throw new Error('Chat input not found. Tried: ' + SELECTORS.chatInput.join(', '));
                }

                // 2. Count current bot messages (baseline)
                const baseline = getBotMessages().length;

                // 3. Focus, set value, dispatch events
                input.focus();
                setNativeValue(input, question);

                // Small delay for React to process the input value
                await new Promise(r => setTimeout(r, 100));

                // 4. Find and click Send (or press Enter)
                const sendBtn = findElement(SELECTORS.sendButton);
                if (sendBtn && !sendBtn.disabled) {
                    sendBtn.click();
                } else {
                    // Fallback: press Enter
                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
                    }));
                }

                // 5. Wait for new bot message (stabilized)
                const response = await watchForNewBotMessage(baseline, timeoutMs);
                const elapsed = Date.now() - start;

                return { response, elapsed };
            },

            /**
             * Reset the conversation (start new session).
             * Waits for the chat to clear (message count drops) or times out after 5s.
             * @returns {Promise<{success: boolean, elapsed: number}>}
             */
            async reset() {
                const start = Date.now();

                const resetBtn = findElement(SELECTORS.resetButton);
                if (!resetBtn) {
                    throw new Error('Reset button not found. Tried: ' + SELECTORS.resetButton.join(', '));
                }

                const beforeCount = getBotMessages().length;
                resetBtn.click();

                // Wait until messages clear or 5s timeout
                const deadline = Date.now() + 5000;
                while (Date.now() < deadline) {
                    await new Promise(r => setTimeout(r, 300));
                    const afterCount = getBotMessages().length;
                    if (afterCount < beforeCount || afterCount <= 1) break;
                }

                return {
                    success: true,
                    elapsed: Date.now() - start
                };
            },

            /**
             * Get the last N bot messages.
             * @param {number} n - Number of messages to return (default 1)
             * @returns {Array<{text: string, timestamp: number}>}
             */
            getMessages(n = 1) {
                return getBotMessages().slice(-n);
            },

            /**
             * Check if the chat input is available (Test Chat is open and ready).
             * @returns {boolean}
             */
            isReady() {
                return !!findElement(SELECTORS.chatInput);
            }
        };

        return 'Test chat harness installed';
    }`;
}

/**
 * Returns a JavaScript string to call sendAndWait with a given question.
 * @param {string} question - The test question
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {string} - browser_evaluate function string
 */
function getSendScript(question, timeoutMs = 60000) {
    // Escape for safe embedding in a single-quoted JS string literal
    const escaped = question
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    return `() => window.__testChat.sendAndWait('${escaped}', ${timeoutMs})`;
}

/**
 * Returns a JavaScript string to reset the conversation.
 * @returns {string} - browser_evaluate function string
 */
function getResetScript() {
    return `() => window.__testChat.reset()`;
}

/**
 * Returns a JavaScript string to check if the harness is installed and ready.
 * @returns {string} - browser_evaluate function string
 */
function getReadyCheckScript() {
    return `() => window.__testChat && window.__testChat.ready && window.__testChat.isReady()`;
}

// --- CLI mode: emit install script for eval skill injection ---
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--emit-install')) {
        console.log(getInstallScript());
    } else if (args.includes('--emit-send')) {
        const idx = args.indexOf('--emit-send');
        const question = args[idx + 1] || 'Hello';
        const timeout = parseInt(args[args.indexOf('--timeout') + 1]) || 60000;
        console.log(getSendScript(question, timeout));
    } else if (args.includes('--emit-reset')) {
        console.log(getResetScript());
    } else if (args.includes('--emit-ready')) {
        console.log(getReadyCheckScript());
    } else {
        console.log(`Test Chat Harness — Injectable browser code for fast Playwright eval

Usage:
  node test-chat-harness.js --emit-install              Print the install script for browser_evaluate
  node test-chat-harness.js --emit-send "question"      Print sendAndWait script for a question
  node test-chat-harness.js --emit-reset                Print reset script
  node test-chat-harness.js --emit-ready                Print ready-check script

Programmatic (require):
  const { getInstallScript, getSendScript } = require('./test-chat-harness');`);
    }
}

module.exports = {
    getInstallScript,
    getSendScript,
    getResetScript,
    getReadyCheckScript
};
