import { WeatherDto } from './weather.service';

export function weatherIconFor(weather: WeatherDto | null): string {
  const condition = weather?.condition?.toLowerCase() ?? '';

  if (condition.includes('rain') || condition.includes('drizzle')) {
    return '☔';
  }

  if (condition.includes('cloud')) {
    return '☁';
  }

  if (condition.includes('storm') || condition.includes('thunder')) {
    return '⚡';
  }

  if (condition.includes('snow')) {
    return '❄';
  }

  return '☀';
}

export function formatWeatherTemperature(value: number | null): string {
  return value === null ? '--' : `${Math.round(value)}°C`;
}

export function formatWeatherUpdatedAt(updatedAt: Date | null): string {
  if (!updatedAt) {
    return 'Updated just now';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(updatedAt);
}
