import { resolveSystemTheme } from './theme.service';

describe('ThemeService system theme resolution', () => {
  it('resolves light when the OS/browser dark preference is off', () => {
    expect(resolveSystemTheme({ matches: false })).toBe('light');
  });

  it('resolves dark when the OS/browser dark preference is on', () => {
    expect(resolveSystemTheme({ matches: true })).toBe('dark');
  });
});
