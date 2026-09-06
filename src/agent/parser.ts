// Command parser — extracts commodity, origin, destination, city/market,
// currencies, period, and objective from a natural-language command.
// Makes reasonable assumptions for non-critical missing parameters and labels
// them explicitly. Never asks unnecessary follow-up questions.

import type { ParsedIntent } from '../lib/types';

const COUNTRIES = [
  'afghanistan', 'russia', 'pakistan', 'india', 'iran', 'kazakhstan', 'uzbekistan',
  'turkey', 'uae', 'united arab emirates', 'china', 'usa', 'united states', 'european union',
  'ukraine', 'germany', 'saudi arabia', 'turkmenistan', 'tajikistan', 'kyrgyzstan',
  'azerbaijan', 'georgia', 'iraq', 'syria', 'lebanon', 'egypt', 'sudan', 'ethiopia',
  'kenya', 'nigeria', 'south africa', 'brazil', 'argentina', 'canada', 'australia',
  'thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'japan', 'south korea',
];

const CITIES: Record<string, string> = {
  kabul: 'Afghanistan',
  mazar: 'Afghanistan',
  'mazar-e-sharif': 'Afghanistan',
  'mazar-i-sharif': 'Afghanistan',
  herat: 'Afghanistan',
  kandahar: 'Afghanistan',
  jalalabad: 'Afghanistan',
  kunduz: 'Afghanistan',
  balkh: 'Afghanistan',
  badakhshan: 'Afghanistan',
  karachi: 'Pakistan',
  lahore: 'Pakistan',
  islamabad: 'Pakistan',
  peshawar: 'Pakistan',
  dubai: 'UAE',
  almaty: 'Kazakhstan',
  moscow: 'Russia',
  istanbul: 'Turkey',
  tehran: 'Iran',
  delhi: 'India',
  'new delhi': 'India',
  mumbai: 'India',
  beijing: 'China',
  shanghai: 'China',
};

const CURRENCIES: Record<string, string> = {
  afghanistan: 'AFN',
  russia: 'RUB',
  pakistan: 'PKR',
  india: 'INR',
  iran: 'IRR',
  kazakhstan: 'KZT',
  uzbekistan: 'UZS',
  turkey: 'TRY',
  uae: 'AED',
  'united arab emirates': 'AED',
  china: 'CNY',
  usa: 'USD',
  'united states': 'USD',
  germany: 'EUR',
  'european union': 'EUR',
  ukraine: 'UAH',
  afn: 'AFN',
  usd: 'USD',
  eur: 'EUR',
  pkr: 'PKR',
  inr: 'INR',
  rub: 'RUB',
  aed: 'AED',
  cny: 'CNY',
  kzt: 'KZT',
  try: 'TRY',
  gbp: 'GBP',
};

const COMMODITIES = [
  'wheat', 'flour', 'rice', 'sugar', 'cooking oil', 'sunflower oil', 'palm oil',
  'soybean oil', 'corn', 'maize', 'barley', 'cotton', 'tea', 'coffee', 'lentils',
  'chickpeas', 'beans', 'mung beans', 'fertilizer', 'urea', 'diesel', 'petrol',
  'gasoline', 'cement', 'steel', 'aluminum', 'copper', 'gold', 'cocoa', 'cotton',
  'onion', 'potato', 'tomato', 'apples', 'bananas', 'chicken', 'beef', 'mutton',
  'milk', 'eggs', 'salt', 'black pepper',
];

const COMMODITY_CATEGORIES: Record<string, string> = {
  wheat: 'Grains',
  flour: 'Grains',
  rice: 'Grains',
  corn: 'Grains',
  maize: 'Grains',
  barley: 'Grains',
  'cooking oil': 'Edible Oils',
  'sunflower oil': 'Edible Oils',
  'palm oil': 'Edible Oils',
  'soybean oil': 'Edible Oils',
  sugar: 'Sweeteners',
  tea: 'Beverages',
  coffee: 'Beverages',
  lentils: 'Pulses',
  chickpeas: 'Pulses',
  beans: 'Pulses',
  'mung beans': 'Pulses',
  fertilizer: 'Inputs',
  urea: 'Inputs',
  diesel: 'Energy',
  petrol: 'Energy',
  gasoline: 'Energy',
  cement: 'Construction',
  steel: 'Metals',
  aluminum: 'Metals',
  copper: 'Metals',
  gold: 'Metals',
  cocoa: 'Soft Commodities',
  cotton: 'Fiber',
  onion: 'Vegetables',
  potato: 'Vegetables',
  tomato: 'Vegetables',
  apples: 'Fruits',
  bananas: 'Fruits',
  chicken: 'Livestock',
  beef: 'Livestock',
  mutton: 'Livestock',
  milk: 'Dairy',
  eggs: 'Dairy',
  salt: 'Condiments',
  'black pepper': 'Spices',
};

export function commodityCategory(commodity: string): string {
  return COMMODITY_CATEGORIES[commodity.toLowerCase()] ?? 'Other';
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/-(\w)/g, (m, c) => {
    // Keep short connector words lowercase after hyphens: e, i, de, du, la, le
    return ['e', 'i', 'de', 'du', 'la', 'le'].includes(c.toLowerCase()) ? `-${c.toLowerCase()}` : m;
  });
}

function findCommodity(text: string): string | null {
  const lower = text.toLowerCase();
  // Multi-word commodities first
  const multi = ['sunflower oil', 'cooking oil', 'palm oil', 'soybean oil', 'mung beans', 'black pepper'];
  for (const c of multi) {
    if (lower.includes(c)) return c;
  }
  for (const c of COMMODITIES) {
    const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) return c;
  }
  return null;
}

function findCountries(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const c of COUNTRIES) {
    const re = new RegExp(`\\b${c}\\b`, 'i');
    if (re.test(lower)) {
      const title = titleCase(c);
      if (!found.some((f) => f.toLowerCase() === c)) found.push(title);
    }
  }
  return found;
}

function findCity(text: string): { city: string; country: string } | null {
  const lower = text.toLowerCase();
  for (const city of Object.keys(CITIES)) {
    const re = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      return { city: titleCase(city), country: CITIES[city] };
    }
  }
  return null;
}

function findCurrencies(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  // Pattern like USD/AFN
  const pairMatch = lower.match(/([a-z]{3})\s*\/\s*([a-z]{3})/);
  if (pairMatch) {
    found.push(pairMatch[1].toUpperCase());
    found.push(pairMatch[2].toUpperCase());
  }
  for (const key of Object.keys(CURRENCIES)) {
    if (key.length !== 3) continue; // only currency codes as standalone words
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(lower)) found.push(CURRENCIES[key]);
  }
  return [...new Set(found)];
}

function detectPeriod(text: string): string {
  const lower = text.toLowerCase();
  if (/\btoday\b|\bnow\b|\bdaily\b|current\b/.test(lower)) return 'today';
  if (/\bweek\b|weekly\b/.test(lower)) return '7days';
  if (/\bmonth\b|monthly\b/.test(lower)) return '30days';
  return 'today';
}

function detectObjective(text: string): string {
  const lower = text.toLowerCase();
  if (/\bcompare\b/.test(lower)) return 'compare';
  if (/\bshould we import\b|\bimport feasibility\b|\bimport research\b|\bshould.*import\b/.test(lower)) return 'import_feasibility';
  if (/\bimport\b.*\bfrom\b|\bimports?\b/.test(lower)) return 'import_research';
  if (/\breport\b|\bweekly\b|\bdaily\b|\bmonthly\b/.test(lower)) return 'report';
  if (/\bfx\b|\bcurrency\b|\bexchange rate\b|\baffect\b.*\b(wheat|flour|oil|rice|commodity)\b/.test(lower)) return 'fx_impact';
  if (/\banalyze\b|\bmarket\b|\bprices?\b/.test(lower)) return 'market_analysis';
  return 'market_analysis';
}

export function parseCommand(raw: string): ParsedIntent {
  const text = raw.trim();
  const assumptions: string[] = [];

  const commodity = findCommodity(text);
  let cityHit = findCity(text);
  const countries = findCountries(text);
  const currencyHits = findCurrencies(text);

  // Determine origin / destination
  let origin: string | null = null;
  let destination: string | null = null;
  const lower = text.toLowerCase();

  // First: try labeled format "Origin: X" / "Destination: Y" / "Target City: Z"
  const originLabel = /\borigin\s*[:-]\s*(.+)/i.exec(text);
  const destLabel = /\b(?:destination|target\s+country)\s*[:-]\s*(.+)/i.exec(text);
  const cityLabel = /\b(?:target\s+city|city|market)\s*[:-]\s*(.+)/i.exec(text);

  if (originLabel) {
    const val = originLabel[1].trim().split(/[\n,;|]/)[0].trim();
    for (const c of COUNTRIES) {
      if (c === val.toLowerCase() || titleCase(c).toLowerCase() === val.toLowerCase()) {
        origin = titleCase(c);
        break;
      }
    }
    if (!origin) origin = titleCase(val);
  }
  if (destLabel) {
    const val = destLabel[1].trim().split(/[\n,;|]/)[0].trim();
    for (const c of COUNTRIES) {
      if (c === val.toLowerCase() || titleCase(c).toLowerCase() === val.toLowerCase()) {
        destination = titleCase(c);
        break;
      }
    }
    if (!destination) destination = titleCase(val);
  }
  // Override city from labeled format if found and more specific
  if (cityLabel) {
    const val = cityLabel[1].trim().split(/[\n,;|]/)[0].trim();
    // Check if it matches a known city
    for (const [cityKey, cityCountry] of Object.entries(CITIES)) {
      if (cityKey === val.toLowerCase() || titleCase(cityKey).toLowerCase() === val.toLowerCase()) {
        cityHit = { city: titleCase(cityKey), country: cityCountry };
        break;
      }
    }
    if (!cityHit) {
      // Use the raw value as city name, keep existing country if destination matches
      cityHit = { city: titleCase(val), country: destination ?? 'Unknown' };
    }
  }

  // Fallback: natural-language "from X to Y" syntax
  if (!origin || !destination) {
    const fromIdx = lower.indexOf(' from ');
    const toIdx = lower.indexOf(' to ');
    if (fromIdx !== -1 && !origin) {
      for (const c of countries) {
        if (lower.slice(fromIdx, toIdx > fromIdx ? toIdx : lower.length).includes(c.toLowerCase())) {
          origin = c;
        }
      }
    }
    if (toIdx !== -1 && !destination) {
      for (const c of countries) {
        if (lower.slice(toIdx).includes(c.toLowerCase()) && c !== origin) {
          destination = c;
        }
      }
    }
  }

  // If "compare X in A and B", treat as comparison with two origins
  const compareAnd = /\bcompare\b.*\bin\b\s+(.*?)\s+and\s+(.*)/i.exec(text);
  if (compareAnd && countries.length >= 2) {
    origin = countries[0];
    destination = countries[1];
  }

  // City/market
  const city: string | null = cityHit?.city ?? null;
  const market: string | null = city ? `${city} Market` : null;

  // Destination from city's country if not set
  if (cityHit && !destination) {
    destination = cityHit.country;
  }

  // If only one country and no city, treat as destination
  if (countries.length === 1 && !destination && !origin) {
    destination = countries[0];
  }

  // Currencies
  let currencies = [...currencyHits];
  if (origin && !currencies.includes(CURRENCIES[origin.toLowerCase()] ?? '')) {
    currencies.push(CURRENCIES[origin.toLowerCase()] ?? '');
  }
  if (destination && !currencies.includes(CURRENCIES[destination.toLowerCase()] ?? '')) {
    currencies.push(CURRENCIES[destination.toLowerCase()] ?? '');
  }
  currencies = currencies.filter((c) => c && c.length === 3);
  if (!currencies.includes('USD')) currencies.push('USD');
  currencies = [...new Set(currencies)];

  // Assumptions
  if (!commodity) {
    // For FX-only questions, no commodity needed
  }
  if (!destination && !origin && !city) {
    assumptions.push('No location specified — defaulting to global commodity market context.');
  }
  if (commodity && !origin && !city) {
    assumptions.push('No origin or city specified — analyzing global market only.');
  }

  const objective = detectObjective(text);
  const period = detectPeriod(text);

  return {
    commodity: commodity ? titleCase(commodity) : null,
    origin,
    destination,
    city,
    market,
    currencies,
    period,
    objective,
    assumptions,
    raw: text,
  };
}

export function intentLabel(intent: ParsedIntent): string {
  const parts: string[] = [];
  if (intent.commodity) parts.push(intent.commodity);
  if (intent.origin) parts.push(`from ${intent.origin}`);
  if (intent.destination) parts.push(`to ${intent.destination}`);
  if (intent.city) parts.push(`in ${intent.city}`);
  if (parts.length === 0) parts.push(intent.raw);
  return parts.join(' ');
}
