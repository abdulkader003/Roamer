import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loadingService = inject(LoadingService);

  if (!isBackendApiRequest(request.url)) {
    return next(request);
  }

  loadingService.start();

  return next(request).pipe(finalize(() => loadingService.stop()));
};

function isBackendApiRequest(url: string): boolean {
  return url.includes('/api/');
}
