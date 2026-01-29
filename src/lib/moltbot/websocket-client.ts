/**
 * Moltbot WebSocket Gateway Client
 * 
 * Implements the Moltbot gateway protocol for real-time communication.
 */

import WebSocket from 'ws';

const GATEWAY_URL = process.env.MOLTBOT_GATEWAY_URL || 'ws://localhost:18789';
const GATEWAY_TOKEN = process.env.MOLTBOT_GATEWAY_TOKEN || 'hada-dev-token-12345';
const PROTOCOL_VERSION = 3;

interface MoltbotFrame {
    type: 'req' | 'res' | 'event' | 'hello-ok';
    id?: string;
    method?: string;
    params?: unknown;
    ok?: boolean;
    payload?: unknown;
    error?: { code: string; message: string };
    event?: string;
    protocol?: number;
}

interface AgentResponse {
    runId: string;
    status: 'accepted' | 'ok' | 'error';
    result?: {
        content?: string;
        message?: string;
    };
    error?: string;
}

// Connection pool for reusing WebSocket connections
let activeConnection: MoltbotConnection | null = null;
let connectionPromise: Promise<MoltbotConnection> | null = null;

class MoltbotConnection {
    private ws: WebSocket | null = null;
    private requestId = 0;
    private pendingRequests: Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private connected = false;
    private handshakeComplete = false;

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(GATEWAY_URL);

            const timeout = setTimeout(() => {
                this.close();
                reject(new Error('Connection timeout'));
            }, 10000);

            this.ws.on('open', () => {
                this.connected = true;
                // Send connect request immediately (new protocol expects req frame first)
                const connectRequest = {
                    type: 'req',
                    id: 'connect-1',
                    method: 'connect',
                    params: {
                        minProtocol: PROTOCOL_VERSION,
                        maxProtocol: PROTOCOL_VERSION,
                        client: {
                            id: 'webchat-ui',
                            version: '1.0.0',
                            platform: 'web',
                            mode: 'webchat',
                        },
                        auth: {
                            token: GATEWAY_TOKEN,
                        },
                    },
                };
                this.ws?.send(JSON.stringify(connectRequest));
            });

            this.ws.on('message', (data) => {
                try {
                    const frame: MoltbotFrame = JSON.parse(data.toString());

                    // Handle connect response (handshake complete)
                    if (frame.type === 'res' && frame.id === 'connect-1') {
                        if (!frame.ok) {
                            clearTimeout(timeout);
                            reject(new Error(frame.error?.message || 'Connect failed'));
                            return;
                        }
                        // Connection accepted
                        clearTimeout(timeout);
                        this.handshakeComplete = true;
                        resolve();
                        return;
                    }

                    // Handle separate hello-ok if it comes (keep for compatibility)
                    if (frame.type === 'hello-ok') {
                        clearTimeout(timeout);
                        this.handshakeComplete = true;
                        resolve();
                        return;
                    }

                    // Handle other responses
                    if (frame.type === 'res' && frame.id) {
                        const pending = this.pendingRequests.get(frame.id);
                        if (pending) {
                            if (frame.ok) {
                                const payload = frame.payload as AgentResponse;
                                // If accepted, keep waiting for completion
                                if (payload && payload.status === 'accepted') {
                                    return;
                                }

                                clearTimeout(pending.timeout);
                                this.pendingRequests.delete(frame.id); // Only remove on final response
                                pending.resolve(payload);
                            } else {
                                clearTimeout(pending.timeout);
                                this.pendingRequests.delete(frame.id);
                                pending.reject(new Error(frame.error?.message || 'Request failed'));
                            }
                        }
                    }

                    // Handle agent events for streaming responses
                    if (frame.type === 'event' && frame.event === 'agent') {
                        // Agent events for streaming - could be handled for real-time updates
                    }
                } catch (e) {
                    console.error('Failed to parse gateway message:', e);
                }
            });

            this.ws.on('error', (error) => {
                clearTimeout(timeout);
                this.connected = false;
                reject(error);
            });

            this.ws.on('close', () => {
                this.connected = false;
                this.handshakeComplete = false;
                // Reject all pending requests
                this.pendingRequests.forEach(({ reject, timeout }) => {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed'));
                });
                this.pendingRequests.clear();
            });
        });
    }

    isConnected(): boolean {
        return this.connected && this.handshakeComplete && this.ws?.readyState === WebSocket.OPEN;
    }

    async sendAgentMessage(message: string, sessionId?: string): Promise<AgentResponse> {
        if (!this.isConnected()) {
            throw new Error('Not connected to gateway');
        }

        const id = `req-${++this.requestId}`;

        const frame: MoltbotFrame = {
            type: 'req',
            id,
            method: 'agent',
            params: {
                message,
                sessionKey: sessionId || 'default',
                idempotencyKey: id,
            },
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }, 60000); // 60s timeout for agent responses

            this.pendingRequests.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
                timeout
            });

            this.ws?.send(JSON.stringify(frame));
        });
    }

    close(): void {
        this.ws?.close();
        this.ws = null;
        this.connected = false;
        this.handshakeComplete = false;
    }
}

/**
 * Get or create a connection to the Moltbot gateway
 */
async function getConnection(): Promise<MoltbotConnection> {
    // Return existing connection if healthy
    if (activeConnection?.isConnected()) {
        return activeConnection;
    }

    // If already connecting, wait for that
    if (connectionPromise) {
        return connectionPromise;
    }

    // Create new connection
    connectionPromise = (async () => {
        const conn = new MoltbotConnection();
        try {
            await conn.connect();
            activeConnection = conn;
            return conn;
        } catch (error) {
            activeConnection = null;
            throw error;
        } finally {
            connectionPromise = null;
        }
    })();

    return connectionPromise;
}

/**
 * Send a message through the Moltbot gateway via WebSocket
 */
export async function sendMessageViaWebSocket(
    message: string,
    sessionId?: string
): Promise<{ content: string; runId: string } | null> {
    try {
        const conn = await getConnection();
        const response = await conn.sendAgentMessage(message, sessionId);

        // sendAgentMessage now waits for 'ok' status
        if (response.status === 'ok' && response.result) {
            return {
                content: response.result.content || response.result.message || '',
                runId: response.runId,
            };
        }

        return null;
    } catch (error) {
        console.error('WebSocket gateway error:', error);
        return null;
    }
}

/**
 * Check if the gateway is available via WebSocket
 */
export async function checkGatewayConnection(): Promise<boolean> {
    try {
        const conn = await getConnection();
        return conn.isConnected();
    } catch {
        return false;
    }
}

/**
 * Close the gateway connection
 */
export function closeGatewayConnection(): void {
    activeConnection?.close();
    activeConnection = null;
}
