import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';

export type LiveEventType =
  | 'NEW_RESULT'
  | 'NEW_PREDICTION'
  | 'PREDICTION_EVALUATED'
  | 'MODEL_UPDATED'
  | 'NUMBER_STATUS_CHANGED'
  | 'SYSTEM_STATUS'
  | 'COUNTDOWN_TICK';

export interface LiveEventPayload {
  type: LiveEventType;
  data: any;
  timestamp: string;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public init(server: any) {
    // Attach WebSocket server on /ws path
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
      if (pathname === '/ws' || pathname === '/ws/') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial welcome message
      ws.send(
        JSON.stringify({
          type: 'SYSTEM_STATUS',
          data: { connected: true, clientCount: this.clients.size },
          timestamp: new Date().toISOString(),
        })
      );

      // Send immediate countdown tick state
      import('./storage.js')
        .then(({ storage }) => {
          if (ws.readyState === WebSocket.OPEN) {
            const activeRoundId = storage.getActiveRoundId();
            const nextDrawTime = storage.getNextDrawTime();
            const config = storage.getConfig();
            const target = new Date(nextDrawTime).getTime();
            const diffMs = target - Date.now();
            const diffSeconds = Math.max(0, Math.ceil(diffMs / 1000));
            ws.send(
              JSON.stringify({
                type: 'COUNTDOWN_TICK',
                data: {
                  activeRoundId,
                  remainingSeconds: diffSeconds,
                  nextDrawTime,
                  roundIntervalSeconds: config.roundIntervalSeconds || 60,
                },
                timestamp: new Date().toISOString(),
              })
            );
          }
        })
        .catch(() => {});

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  public broadcast(type: LiveEventType, data: any) {
    const payload: LiveEventPayload = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    const message = JSON.stringify(payload);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch {
          // ignore closed socket errors
        }
      }
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
