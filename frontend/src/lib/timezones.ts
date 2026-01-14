export interface Timezone {
  value: string;
  label: string;
  offset: string;
}

export const TIMEZONES: Timezone[] = [
  // América
  { value: 'America/Santiago', label: '🇨🇱 Santiago (Chile)', offset: 'GMT-3/-4' },
  { value: 'America/New_York', label: '🇺🇸 New York (EST)', offset: 'GMT-5/-4' },
  { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (PST)', offset: 'GMT-8/-7' },
  { value: 'America/Chicago', label: '🇺🇸 Chicago (CST)', offset: 'GMT-6/-5' },
  { value: 'America/Mexico_City', label: '🇲🇽 Ciudad de México', offset: 'GMT-6/-5' },
  { value: 'America/Bogota', label: '🇨🇴 Bogotá', offset: 'GMT-5' },
  { value: 'America/Lima', label: '🇵🇪 Lima', offset: 'GMT-5' },
  { value: 'America/Buenos_Aires', label: '🇦🇷 Buenos Aires', offset: 'GMT-3' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo', offset: 'GMT-3' },
  { value: 'America/Caracas', label: '🇻🇪 Caracas', offset: 'GMT-4' },
  { value: 'America/Panama', label: '🇵🇦 Panamá', offset: 'GMT-5' },
  
  // Europa
  { value: 'Europe/Madrid', label: '🇪🇸 Madrid', offset: 'GMT+1/+2' },
  { value: 'Europe/London', label: '🇬🇧 Londres', offset: 'GMT+0/+1' },
  { value: 'Europe/Paris', label: '🇫🇷 París', offset: 'GMT+1/+2' },
  { value: 'Europe/Berlin', label: '🇩🇪 Berlín', offset: 'GMT+1/+2' },
  { value: 'Europe/Rome', label: '🇮🇹 Roma', offset: 'GMT+1/+2' },
  
  // Asia
  { value: 'Asia/Tokyo', label: '🇯🇵 Tokio', offset: 'GMT+9' },
  { value: 'Asia/Shanghai', label: '🇨🇳 Shanghái', offset: 'GMT+8' },
  { value: 'Asia/Dubai', label: '🇦🇪 Dubai', offset: 'GMT+4' },
  { value: 'Asia/Singapore', label: '🇸🇬 Singapur', offset: 'GMT+8' },
  
  // Oceanía
  { value: 'Australia/Sydney', label: '🇦🇺 Sídney', offset: 'GMT+10/+11' },
  { value: 'Pacific/Auckland', label: '🇳🇿 Auckland', offset: 'GMT+12/+13' },
];

/**
 * Busca un timezone por su value
 */
export function findTimezone(value: string): Timezone | undefined {
  return TIMEZONES.find(tz => tz.value === value);
}

/**
 * Obtiene el timezone por defecto
 */
export function getDefaultTimezone(): Timezone {
  return TIMEZONES[0]; // America/Santiago
}

