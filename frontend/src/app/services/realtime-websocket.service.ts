import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
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
  private readonly destinationStreams = new Map<string, Subject<unknown>>();
  private readonly activeSubscriptions = new Map<string, StompSubscription>();

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

  observe<T>(destination: string): Observable<T> {
    const stream = this.getOrCreateStream<T>(destination);
    this.ensureSubscription(destination);
    return stream.asObservable();
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
      this.resubscribeAll();
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

    this.unsubscribeAll();

    if (!this.stompClient) {
      return;
    }

    void this.stompClient.deactivate();
    this.stompClient = null;
  }

  private getOrCreateStream<T>(destination: string): Subject<T> {
    const existing = this.destinationStreams.get(destination);
    if (existing) {
      return existing as Subject<T>;
    }

    const stream = new Subject<T>();
    this.destinationStreams.set(destination, stream as Subject<unknown>);
    return stream;
  }

  private ensureSubscription(destination: string): void {
    if (!this.stompClient?.active || this.activeSubscriptions.has(destination)) {
      return;
    }

    const subscription = this.stompClient.subscribe(destination, (message: IMessage) => {
      const stream = this.destinationStreams.get(destination);
      if (!stream) {
        return;
      }

      try {
        stream.next(JSON.parse(message.body) as unknown);
      } catch {
        stream.next(message.body as unknown);
      }
    });

    this.activeSubscriptions.set(destination, subscription);
  }

  private resubscribeAll(): void {
    this.unsubscribeAll();

    for (const destination of this.destinationStreams.keys()) {
      this.ensureSubscription(destination);
    }
  }

  private unsubscribeAll(): void {
    for (const subscription of this.activeSubscriptions.values()) {
      subscription.unsubscribe();
    }

    this.activeSubscriptions.clear();
  }
}
