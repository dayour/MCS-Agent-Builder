/**
 * Test Chat Harness — Injectable browser code for fast Playwright Test Chat eval.
 *
 * Instead of the 5-step snapshot-poll loop per test (~15-30s), this harness
 * injects into the MCS Test Chat page and uses MutationObserver to detect
 * bot responses in real time. Each test becomes a single browser_evaluate call (~3-8s).
 *
 * Usage (from mcs-eval skill):
 *   1. Inject once:   browser_evaluate({ function: getInstallScript() })
 *   2. Per test:      browser_evaluate({ function: `() => window.__testChat.sendAndWait("question", 30000)` })
 *   3. Reset:         browser_evaluate({ function: `() => window.__testChat.reset()` })
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
         */
        function getBotMessages() {
            const messages = [];
            for (const sel of SELECTORS.botMessage) {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) {
                    els.forEach(el => {
                        const text = el.innerText || el.textContent || '';
                        if (text.trim()) {
                            messages.push({
                                text: text.trim(),
                                timestamp: Date.now(),
                                element: el
                            });
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
         * Wait for a condition with polling (simpler fallback for MutationObserver).
         */
        function waitForCondition(conditionFn, timeoutMs, pollMs = 300) {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                const check = () => {
                    const result = conditionFn();
                    if (result) {
                        resolve(result);
                    } else if (Date.now() - start > timeoutMs) {
                        reject(new Error('Timeout waiting for condition'));
                    } else {
                        setTimeout(check, pollMs);
                    }
                };
                check();
            });
        }

        /**
         * Watch the DOM for a new bot message using MutationObserver.
         * Falls back to polling if Observer doesn't fire within pollMs.
         */
        function watchForNewBotMessage(baselineCount, timeoutMs) {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                let resolved = false;

                const tryResolve = () => {
                    if (resolved) return;
                    const current = getBotMessages();
                    if (current.length > baselineCount) {
                        resolved = true;
                        const newMsg = current[current.length - 1];
                        // Wait a beat for streaming to finish
                        setTimeout(() => {
                            const final = getBotMessages();
                            const finalMsg = final[final.length - 1];
                            resolve(finalMsg.text);
                        }, 500);
                    }
                };

                // Strategy 1: MutationObserver on the chat feed
                const feed = findElement(SELECTORS.chatFeed);
                let observer = null;

                if (feed) {
                    observer = new MutationObserver(() => tryResolve());
                    observer.observe(feed, {
                        childList: true,
                        subtree: true,
                        characterData: true
                    });
                }

                // Strategy 2: Polling fallback (catches cases where Observer misses)
                const pollInterval = setInterval(() => {
                    if (resolved) {
                        clearInterval(pollInterval);
                        if (observer) observer.disconnect();
                        return;
                    }
                    if (Date.now() - start > timeoutMs) {
                        clearInterval(pollInterval);
                        if (observer) observer.disconnect();
                        if (!resolved) {
                            resolved = true;
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
                        }
                        return;
                    }
                    tryResolve();
                }, 500);

                // Hard timeout safety net
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        clearInterval(pollInterval);
                        if (observer) observer.disconnect();
                        const final = getBotMessages();
                        if (final.length > baselineCount) {
                            resolve(final[final.length - 1].text);
                        } else {
                            reject(new Error(
                                'Hard timeout: no bot response within ' + (timeoutMs / 1000) + 's'
                            ));
                        }
                    }
                }, timeoutMs + 1000);
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

                // 5. Wait for new bot message
                const response = await watchForNewBotMessage(baseline, timeoutMs);
                const elapsed = Date.now() - start;

                return { response, elapsed };
            },

            /**
             * Reset the conversation (start new session).
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

                // Wait for either: message count drops, or a greeting message appears
                await new Promise(r => setTimeout(r, 1500));

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
                const msgs = getBotMessages();
                return msgs.slice(-n).map(m => ({ text: m.text, timestamp: m.timestamp }));
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
    // Escape the question for safe embedding in a JS string literal
    const escaped = question.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
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

module.exports = {
    getInstallScript,
    getSendScript,
    getResetScript,
    getReadyCheckScript
};
