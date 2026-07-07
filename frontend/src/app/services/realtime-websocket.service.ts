import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AuthService } from './auth';

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Owns the application's STOMP/SockJS connection lifecycle.
 *
 * <p>No feature events are wired yet. The service only keeps the transport
 * connection ready for future real-time updates.</p>
 */
@Injectable({
  providedIn: 'root',
})
export class RealtimeWebSocketService {
  private readonly authService = inject(AuthService);
  private stompClient: Client | null = null;
  private currentToken = '';
  private readonly state = signal<RealtimeConnectionState>('disconnected');

  readonly connectionState = this.state.asReadonly();
  readonly isConnected = computed(() => this.state() === 'connected');

  constructor() {
    effect(
      () => {
        const token = this.authService.token().trim();

        if (!token) {
          this.disconnect();
          return;
        }

        this.connect(token);
      },
      { allowSignalWrites: true }
    );
  }

  connect(token?: string): void {
    const nextToken = token?.trim() || this.authService.token().trim();

    if (!nextToken) {
      this.disconnect();
      return;
    }

    if (this.currentToken === nextToken && this.stompClient?.active) {
      return;
    }

    if (this.stompClient) {
      void this.stompClient.deactivate();
      this.stompClient = null;
    }

    this.currentToken = nextToken;
    this.state.set('connecting');

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws') as unknown as WebSocket,
      connectHeaders: {
        Authorization: `Bearer ${nextToken}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => undefined,
    });

    client.onConnect = () => {
      this.state.set('connected');
    };

    client.onStompError = () => {
      this.state.set('error');
    };

    client.onWebSocketClose = () => {
      if (this.authService.token().trim()) {
        this.state.set('connecting');
        return;
      }

      this.state.set('disconnected');
    };

    this.stompClient = client;
    client.activate();
  }

  disconnect(): void {
    this.currentToken = '';
    this.state.set('disconnected');

    if (!this.stompClient) {
      return;
    }

    void this.stompClient.deactivate();
    this.stompClient = null;
  }
}
