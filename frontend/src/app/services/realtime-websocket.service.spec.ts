import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Client } from '@stomp/stompjs';
import { AuthService } from './auth';
import { RealtimeWebSocketService } from './realtime-websocket.service';

describe('RealtimeWebSocketService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('activates a websocket connection when a token exists', () => {
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
    expect(Client.prototype.activate).toHaveBeenCalled();
  });
});
