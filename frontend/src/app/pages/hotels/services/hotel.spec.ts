import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { HotelService } from './hotel.service';

describe('Hotel', () => {
  let service: HotelService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(HotelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
