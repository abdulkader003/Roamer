import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Client } from '@stomp/stompjs';
import { AuthService } from './auth';
import { RealtimeWebSocketService } from './realtime-websocket.service';

describe('RealtimeWebSocketService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the native broker URL and avoids duplicate activation for the same token', () => {
    const authToken = signal('test-token');

    const authService = {
      token: authToken,
    };

    spyOn(Client.prototype, 'activate').and.stub();
    spyOn(Client.prototype, 'deactivate').and.stub();

    TestBed.configureTestingModule({
      providers: [
        RealtimeWebSocketService,
        { provide: AuthService, useValue: authService },
      ],
    });

    const service = TestBed.inject(RealtimeWebSocketService);

    expect(service.connectionState()).toBe('connecting');
    expect(Client.prototype.activate).toHaveBeenCalledTimes(1);
    expect((service as any).stompClient?.brokerURL).toBe('ws://localhost:8080/ws-native');

    service.connect('test-token');

    expect(Client.prototype.activate).toHaveBeenCalledTimes(1);
  });
});
