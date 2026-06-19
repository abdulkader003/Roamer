import { Injectable } from '@angular/core';

export interface AirportOption {
  code: string;
  city: string;
  fullName: string;
}

@Injectable({
  providedIn: 'root'
})
export class AirportOptionsService {
  private readonly airports: AirportOption[] = [
    { code: 'DUS', city: 'Düsseldorf', fullName: 'Düsseldorf Intl.' },
    { code: 'CGN', city: 'Cologne', fullName: 'Cologne Bonn Airport' },
    { code: 'HAM', city: 'Hamburg', fullName: 'Hamburg Airport' },
    { code: 'STR', city: 'Stuttgart', fullName: 'Stuttgart Airport' },
    { code: 'NUE', city: 'Nuremberg', fullName: 'Nuremberg Airport' },
    { code: 'HAJ', city: 'Hanover', fullName: 'Hannover Airport' },
    { code: 'LEJ', city: 'Leipzig', fullName: 'Leipzig/Halle Airport' },
    { code: 'DRS', city: 'Dresden', fullName: 'Dresden Airport' },
    { code: 'BRE', city: 'Bremen', fullName: 'Bremen Airport' },
    { code: 'DTM', city: 'Dortmund', fullName: 'Dortmund Airport' },
    { code: 'BER', city: 'Berlin', fullName: 'Berlin Brandenburg' },
    { code: 'FRA', city: 'Frankfurt', fullName: 'Frankfurt Airport' },
    { code: 'MUC', city: 'Munich', fullName: 'Munich Airport' },
    { code: 'CDG', city: 'Paris', fullName: 'Charles de Gaulle' },
    { code: 'ORY', city: 'Paris', fullName: 'Paris Orly' },
    { code: 'NCE', city: 'Nice', fullName: 'Nice Côte d’Azur' },
    { code: 'LYS', city: 'Lyon', fullName: 'Lyon-Saint Exupéry' },
    { code: 'MRS', city: 'Marseille', fullName: 'Marseille Provence' },
    { code: 'TLS', city: 'Toulouse', fullName: 'Toulouse-Blagnac' },
    { code: 'LHR', city: 'London', fullName: 'Heathrow' },
    { code: 'LGW', city: 'London', fullName: 'Gatwick' },
    { code: 'STN', city: 'London', fullName: 'Stansted' },
    { code: 'MAN', city: 'Manchester', fullName: 'Manchester Airport' },
    { code: 'EDI', city: 'Edinburgh', fullName: 'Edinburgh Airport' },
    { code: 'DUB', city: 'Dublin', fullName: 'Dublin Airport' },
    { code: 'BCN', city: 'Barcelona', fullName: 'Barcelona-El Prat' },
    { code: 'MAD', city: 'Madrid', fullName: 'Adolfo Suárez Madrid-Barajas' },
    { code: 'PMI', city: 'Palma de Mallorca', fullName: 'Palma de Mallorca Airport' },
    { code: 'AGP', city: 'Málaga', fullName: 'Málaga-Costa del Sol' },
    { code: 'ALC', city: 'Alicante', fullName: 'Alicante-Elche' },
    { code: 'VLC', city: 'Valencia', fullName: 'Valencia Airport' },
    { code: 'SVQ', city: 'Seville', fullName: 'Seville Airport' },
    { code: 'BIO', city: 'Bilbao', fullName: 'Bilbao Airport' },
    { code: 'FCO', city: 'Rome', fullName: 'Fiumicino' },
    { code: 'CIA', city: 'Rome', fullName: 'Ciampino' },
    { code: 'MXP', city: 'Milan', fullName: 'Malpensa' },
    { code: 'LIN', city: 'Milan', fullName: 'Linate' },
    { code: 'BGY', city: 'Milan', fullName: 'Bergamo Orio al Serio' },
    { code: 'VCE', city: 'Venice', fullName: 'Marco Polo' },
    { code: 'NAP', city: 'Naples', fullName: 'Naples Intl.' },
    { code: 'BLQ', city: 'Bologna', fullName: 'Bologna Guglielmo Marconi' },
    { code: 'CTA', city: 'Catania', fullName: 'Catania-Fontanarossa' },
    { code: 'PMO', city: 'Palermo', fullName: 'Palermo Airport' },
    { code: 'VIE', city: 'Vienna', fullName: 'Vienna Intl.' },
    { code: 'SZG', city: 'Salzburg', fullName: 'Salzburg Airport' },
    { code: 'INN', city: 'Innsbruck', fullName: 'Innsbruck Airport' },
    { code: 'BUD', city: 'Budapest', fullName: 'Budapest Ferenc Liszt' },
    { code: 'PRG', city: 'Prague', fullName: 'Václav Havel Airport' },
    { code: 'WAW', city: 'Warsaw', fullName: 'Warsaw Chopin' },
    { code: 'KRK', city: 'Kraków', fullName: 'John Paul II Kraków-Balice' },
    { code: 'GDN', city: 'Gdańsk', fullName: 'Gdańsk Lech Wałęsa' },
    { code: 'AMS', city: 'Amsterdam', fullName: 'Amsterdam Schiphol' },
    { code: 'EIN', city: 'Eindhoven', fullName: 'Eindhoven Airport' },
    { code: 'BRU', city: 'Brussels', fullName: 'Brussels Airport' },
    { code: 'CRL', city: 'Brussels', fullName: 'Charleroi' },
    { code: 'LIS', city: 'Lisbon', fullName: 'Humberto Delgado' },
    { code: 'OPO', city: 'Porto', fullName: 'Francisco Sá Carneiro' },
    { code: 'FAO', city: 'Faro', fullName: 'Faro Airport' },
    { code: 'ZRH', city: 'Zurich', fullName: 'Zurich Airport' },
    { code: 'GVA', city: 'Geneva', fullName: 'Geneva Airport' },
    { code: 'BSL', city: 'Basel', fullName: 'EuroAirport Basel-Mulhouse-Freiburg' },
    { code: 'CPH', city: 'Copenhagen', fullName: 'Copenhagen Airport' },
    { code: 'ARN', city: 'Stockholm', fullName: 'Stockholm Arlanda' },
    { code: 'OSL', city: 'Oslo', fullName: 'Oslo Gardermoen' },
    { code: 'HEL', city: 'Helsinki', fullName: 'Helsinki Airport' },
    { code: 'KEF', city: 'Reykjavík', fullName: 'Keflavík Intl.' },
    { code: 'ATH', city: 'Athens', fullName: 'Athens Intl.' },
    { code: 'SKG', city: 'Thessaloniki', fullName: 'Thessaloniki Airport' },
    { code: 'HER', city: 'Heraklion', fullName: 'Heraklion Intl.' },
    { code: 'JTR', city: 'Santorini', fullName: 'Santorini Airport' },
    { code: 'IST', city: 'Istanbul', fullName: 'Istanbul Airport' },
    { code: 'SAW', city: 'Istanbul', fullName: 'Sabiha Gökçen' },
    { code: 'AYT', city: 'Antalya', fullName: 'Antalya Airport' },
    { code: 'BEY', city: 'Beirut', fullName: 'Beirut-Rafic Hariri Intl.' },
    { code: 'DAM', city: 'Damascus', fullName: 'Damascus Intl.' },
    { code: 'AMM', city: 'Amman', fullName: 'Queen Alia Intl.' },
    { code: 'AQJ', city: 'Aqaba', fullName: 'King Hussein Intl.' },
    { code: 'LCA', city: 'Larnaca', fullName: 'Larnaca Intl.' },
    { code: 'PFO', city: 'Paphos', fullName: 'Paphos Intl.' },
    { code: 'TLV', city: 'Tel Aviv', fullName: 'Ben Gurion Intl.' },
    { code: 'BGW', city: 'Baghdad', fullName: 'Baghdad Intl.' },
    { code: 'EBL', city: 'Erbil', fullName: 'Erbil Intl.' },
    { code: 'KWI', city: 'Kuwait City', fullName: 'Kuwait Intl.' },
    { code: 'BAH', city: 'Manama', fullName: 'Bahrain Intl.' },
    { code: 'MCT', city: 'Muscat', fullName: 'Muscat Intl.' },
    { code: 'RUH', city: 'Riyadh', fullName: 'King Khalid Intl.' },
    { code: 'JED', city: 'Jeddah', fullName: 'King Abdulaziz Intl.' },
    { code: 'MED', city: 'Medina', fullName: 'Prince Mohammad bin Abdulaziz Intl.' },
    { code: 'IKA', city: 'Tehran', fullName: 'Imam Khomeini Intl.' },
    { code: 'TBS', city: 'Tbilisi', fullName: 'Tbilisi Intl.' },
    { code: 'EVN', city: 'Yerevan', fullName: 'Zvartnots Intl.' },
    { code: 'JFK', city: 'New York', fullName: 'John F. Kennedy' },
    { code: 'EWR', city: 'New York', fullName: 'Newark Liberty' },
    { code: 'LGA', city: 'New York', fullName: 'LaGuardia' },
    { code: 'BOS', city: 'Boston', fullName: 'Logan Intl.' },
    { code: 'IAD', city: 'Washington', fullName: 'Dulles Intl.' },
    { code: 'ORD', city: 'Chicago', fullName: 'O’Hare Intl.' },
    { code: 'MIA', city: 'Miami', fullName: 'Miami Intl.' },
    { code: 'LAX', city: 'Los Angeles', fullName: 'Los Angeles Intl.' },
    { code: 'SFO', city: 'San Francisco', fullName: 'San Francisco Intl.' },
    { code: 'SEA', city: 'Seattle', fullName: 'Seattle-Tacoma' },
    { code: 'YYZ', city: 'Toronto', fullName: 'Toronto Pearson' },
    { code: 'YUL', city: 'Montréal', fullName: 'Montréal-Trudeau' },
    { code: 'DXB', city: 'Dubai', fullName: 'Dubai Intl.' },
    { code: 'AUH', city: 'Abu Dhabi', fullName: 'Zayed Intl.' },
    { code: 'DOH', city: 'Doha', fullName: 'Hamad Intl.' },
    { code: 'CAI', city: 'Cairo', fullName: 'Cairo Intl.' },
    { code: 'HRG', city: 'Hurghada', fullName: 'Hurghada Intl.' },
    { code: 'SSH', city: 'Sharm El Sheikh', fullName: 'Sharm El Sheikh Intl.' },
    { code: 'CMN', city: 'Casablanca', fullName: 'Mohammed V Intl.' },
    { code: 'RAK', city: 'Marrakesh', fullName: 'Marrakesh Menara' },
    { code: 'TUN', city: 'Tunis', fullName: 'Tunis-Carthage' },
    { code: 'JNB', city: 'Johannesburg', fullName: 'O. R. Tambo Intl.' },
    { code: 'CPT', city: 'Cape Town', fullName: 'Cape Town Intl.' },
    { code: 'HND', city: 'Tokyo', fullName: 'Haneda' },
    { code: 'NRT', city: 'Tokyo', fullName: 'Narita Intl.' },
    { code: 'ICN', city: 'Seoul', fullName: 'Incheon Intl.' },
    { code: 'PEK', city: 'Beijing', fullName: 'Beijing Capital' },
    { code: 'PVG', city: 'Shanghai', fullName: 'Shanghai Pudong' },
    { code: 'HKG', city: 'Hong Kong', fullName: 'Hong Kong Intl.' },
    { code: 'SIN', city: 'Singapore', fullName: 'Changi' },
    { code: 'BKK', city: 'Bangkok', fullName: 'Suvarnabhumi' },
    { code: 'KUL', city: 'Kuala Lumpur', fullName: 'Kuala Lumpur Intl.' },
    { code: 'DEL', city: 'Delhi', fullName: 'Indira Gandhi Intl.' },
    { code: 'BOM', city: 'Mumbai', fullName: 'Chhatrapati Shivaji Maharaj Intl.' },
    { code: 'SYD', city: 'Sydney', fullName: 'Sydney Kingsford Smith' },
    { code: 'MEL', city: 'Melbourne', fullName: 'Melbourne Airport' },
  ];

  search(query: string, limit = 8): AirportOption[] {
    const normalizedQuery = this.normalize(query);

    if (!normalizedQuery) {
      return this.airports.slice(0, limit);
    }

    return this.airports
      .filter((airport) => this.searchText(airport).includes(normalizedQuery))
      .sort((a, b) => this.rank(a, normalizedQuery) - this.rank(b, normalizedQuery))
      .slice(0, limit);
  }

  find(value: string | null | undefined): AirportOption | null {
    const rawValue = value ?? '';
    const normalizedValue = this.normalize(rawValue);

    if (!normalizedValue) {
      return null;
    }

    const codeFromText = rawValue.match(/\(([A-Za-z]{3})\)\s*$/)?.[1]
      ?? rawValue.match(/^[A-Za-z]{3}$/)?.[0]
      ?? '';

    return this.airports.find((airport) =>
      this.normalize(airport.code) === this.normalize(codeFromText)
      || this.normalize(airport.code) === normalizedValue
      || this.normalize(airport.city) === normalizedValue
      || this.normalize(airport.fullName) === normalizedValue
      || this.normalize(this.formatAirport(airport)) === normalizedValue
    ) ?? null;
  }

  formatAirport(airport: AirportOption): string {
    return `${airport.fullName} · ${airport.city} (${airport.code})`;
  }

  private searchText(airport: AirportOption): string {
    return this.normalize(`${airport.code} ${airport.city} ${airport.fullName} ${this.formatAirport(airport)}`);
  }

  private rank(airport: AirportOption, query: string): number {
    if (this.normalize(airport.code).startsWith(query)) {
      return 0;
    }

    if (this.normalize(airport.city).startsWith(query)) {
      return 1;
    }

    if (this.normalize(airport.fullName).startsWith(query)) {
      return 2;
    }

    return 3;
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
