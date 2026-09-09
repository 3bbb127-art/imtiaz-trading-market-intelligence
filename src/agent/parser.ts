// Global Market Intelligence command parser.
//
// Design principles:
// 1. Import route and comparison are DIFFERENT concepts.
// 2. Comparison markets are stored independently from origin/destination.
// 3. A country used as market context must not become a comparison market.
// 4. Natural-language commands work globally, not only for Afghanistan.
// 5. Existing ParsedIntent fields remain backward-compatible.
// 6. Comparison metadata is additive.
// 7. Comparison never creates a fictional import route.
//
// Examples:
//
// Compare wheat prices in Russia and Kazakhstan for Afghanistan.
// -> comparisonMarkets: ["Russia", "Kazakhstan"]
// -> comparisonContext: "Afghanistan"
// -> origin: null
// -> destination: "Afghanistan"
//
// Research wheat imports from Russia to Afghanistan.
// -> origin: "Russia"
// -> destination: "Afghanistan"
// -> comparisonMarkets: []
//
// Compare rice prices in India and Pakistan.
// -> comparisonMarkets: ["India", "Pakistan"]
// -> comparisonContext: null
// -> origin: null
// -> destination: null
//
// Compare sunflower oil from Russia vs Kazakhstan for Kabul.
// -> comparisonMarkets: ["Russia", "Kazakhstan"]
// -> comparisonContext: "Afghanistan"
// -> city: "Kabul"
// -> origin: null
// -> destination: "Afghanistan"

import type { ParsedIntent } from '../lib/types';

type ExtendedParsedIntent = ParsedIntent & {
  comparisonMarkets: string[];
  comparisonContext: string | null;
};

interface CountryMatch {
  canonical: string;
  start: number;
  end: number;
}

interface CityHit {
  city: string;
  country: string;
}

/* -------------------------------------------------------------------------- */
/* GLOBAL COUNTRIES                                                           */
/* -------------------------------------------------------------------------- */

const COUNTRIES = [
  'afghanistan',
  'albania',
  'algeria',
  'andorra',
  'angola',
  'antigua and barbuda',
  'argentina',
  'armenia',
  'australia',
  'austria',
  'azerbaijan',
  'bahamas',
  'bahrain',
  'bangladesh',
  'barbados',
  'belarus',
  'belgium',
  'belize',
  'benin',
  'bhutan',
  'bolivia',
  'bosnia and herzegovina',
  'botswana',
  'brazil',
  'brunei',
  'bulgaria',
  'burkina faso',
  'burundi',
  'cabo verde',
  'cambodia',
  'cameroon',
  'canada',
  'central african republic',
  'chad',
  'chile',
  'china',
  'colombia',
  'comoros',
  'congo',
  'costa rica',
  'croatia',
  'cuba',
  'cyprus',
  'czech republic',
  'denmark',
  'djibouti',
  'dominica',
  'dominican republic',
  'ecuador',
  'egypt',
  'el salvador',
  'equatorial guinea',
  'eritrea',
  'estonia',
  'eswatini',
  'ethiopia',
  'fiji',
  'finland',
  'france',
  'gabon',
  'gambia',
  'georgia',
  'germany',
  'ghana',
  'greece',
  'grenada',
  'guatemala',
  'guinea',
  'guinea-bissau',
  'guyana',
  'haiti',
  'honduras',
  'hungary',
  'iceland',
  'india',
  'indonesia',
  'iran',
  'iraq',
  'ireland',
  'israel',
  'italy',
  'ivory coast',
  'jamaica',
  'japan',
  'jordan',
  'kazakhstan',
  'kenya',
  'kiribati',
  'kuwait',
  'kyrgyzstan',
  'laos',
  'latvia',
  'lebanon',
  'lesotho',
  'liberia',
  'libya',
  'liechtenstein',
  'lithuania',
  'luxembourg',
  'madagascar',
  'malawi',
  'malaysia',
  'maldives',
  'mali',
  'malta',
  'marshall islands',
  'mauritania',
  'mauritius',
  'mexico',
  'micronesia',
  'moldova',
  'monaco',
  'mongolia',
  'montenegro',
  'morocco',
  'mozambique',
  'myanmar',
  'namibia',
  'nauru',
  'nepal',
  'netherlands',
  'new zealand',
  'nicaragua',
  'niger',
  'nigeria',
  'north korea',
  'north macedonia',
  'norway',
  'oman',
  'pakistan',
  'palau',
  'palestine',
  'panama',
  'papua new guinea',
  'paraguay',
  'peru',
  'philippines',
  'poland',
  'portugal',
  'qatar',
  'romania',
  'russia',
  'rwanda',
  'saint kitts and nevis',
  'saint lucia',
  'saint vincent and the grenadines',
  'samoa',
  'san marino',
  'sao tome and principe',
  'saudi arabia',
  'senegal',
  'serbia',
  'seychelles',
  'sierra leone',
  'singapore',
  'slovakia',
  'slovenia',
  'solomon islands',
  'somalia',
  'south africa',
  'south korea',
  'south sudan',
  'spain',
  'sri lanka',
  'sudan',
  'suriname',
  'sweden',
  'switzerland',
  'syria',
  'tajikistan',
  'tanzania',
  'thailand',
  'timor-leste',
  'togo',
  'tonga',
  'trinidad and tobago',
  'tunisia',
  'turkey',
  'turkmenistan',
  'tuvalu',
  'uganda',
  'ukraine',
  'united arab emirates',
  'united kingdom',
  'united states',
  'uruguay',
  'uzbekistan',
  'vanuatu',
  'vatican city',
  'venezuela',
  'vietnam',
  'yemen',
  'zambia',
  'zimbabwe',
  'european union',
] as const;

/* -------------------------------------------------------------------------- */
/* COUNTRY ALIASES                                                            */
/* -------------------------------------------------------------------------- */

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States',
  us: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  america: 'United States',

  uk: 'United Kingdom',
  gb: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',

  uae: 'United Arab Emirates',
  emirates: 'United Arab Emirates',

  eu: 'European Union',

  iranian: 'Iran',
  russian: 'Russia',
  kazakh: 'Kazakhstan',
  kazakhstani: 'Kazakhstan',
  pakistani: 'Pakistan',
  indian: 'India',
  afghan: 'Afghanistan',

  czechia: 'Czech Republic',
  'republic of korea': 'South Korea',
  korea: 'South Korea',
  dprk: 'North Korea',

  macedonia: 'North Macedonia',
  vietnamese: 'Vietnam',
};

/* -------------------------------------------------------------------------- */
/* CURRENCIES                                                                 */
/* -------------------------------------------------------------------------- */

const CURRENCIES: Record<string, string> = {
  afghanistan: 'AFN',
  albania: 'ALL',
  algeria: 'DZD',
  argentina: 'ARS',
  armenia: 'AMD',
  australia: 'AUD',
  austria: 'EUR',
  azerbaijan: 'AZN',
  bahrain: 'BHD',
  bangladesh: 'BDT',
  belarus: 'BYN',
  belgium: 'EUR',
  bolivia: 'BOB',
  'bosnia and herzegovina': 'BAM',
  brazil: 'BRL',
  bulgaria: 'BGN',
  cambodia: 'KHR',
  canada: 'CAD',
  chile: 'CLP',
  china: 'CNY',
  colombia: 'COP',
  croatia: 'EUR',
  'czech republic': 'CZK',
  denmark: 'DKK',
  egypt: 'EGP',
  estonia: 'EUR',
  'european union': 'EUR',
  france: 'EUR',
  georgia: 'GEL',
  germany: 'EUR',
  ghana: 'GHS',
  greece: 'EUR',
  hungary: 'HUF',
  iceland: 'ISK',
  india: 'INR',
  indonesia: 'IDR',
  iran: 'IRR',
  iraq: 'IQD',
  ireland: 'EUR',
  israel: 'ILS',
  italy: 'EUR',
  japan: 'JPY',
  jordan: 'JOD',
  kazakhstan: 'KZT',
  kenya: 'KES',
  kuwait: 'KWD',
  kyrgyzstan: 'KGS',
  latvia: 'EUR',
  lebanon: 'LBP',
  lithuania: 'EUR',
  luxembourg: 'EUR',
  malaysia: 'MYR',
  mexico: 'MXN',
  moldova: 'MDL',
  mongolia: 'MNT',
  morocco: 'MAD',
  myanmar: 'MMK',
  nepal: 'NPR',
  netherlands: 'EUR',
  'new zealand': 'NZD',
  nigeria: 'NGN',
  norway: 'NOK',
  oman: 'OMR',
  pakistan: 'PKR',
  philippines: 'PHP',
  poland: 'PLN',
  portugal: 'EUR',
  qatar: 'QAR',
  romania: 'RON',
  russia: 'RUB',
  'saudi arabia': 'SAR',
  serbia: 'RSD',
  singapore: 'SGD',
  slovakia: 'EUR',
  slovenia: 'EUR',
  'south africa': 'ZAR',
  'south korea': 'KRW',
  spain: 'EUR',
  'sri lanka': 'LKR',
  sudan: 'SDG',
  sweden: 'SEK',
  switzerland: 'CHF',
  syria: 'SYP',
  tajikistan: 'TJS',
  thailand: 'THB',
  tunisia: 'TND',
  turkey: 'TRY',
  turkmenistan: 'TMT',
  ukraine: 'UAH',
  'united arab emirates': 'AED',
  'united kingdom': 'GBP',
  'united states': 'USD',
  uruguay: 'UYU',
  uzbekistan: 'UZS',
  venezuela: 'VES',
  vietnam: 'VND',
  yemen: 'YER',
  zambia: 'ZMW',
  zimbabwe: 'ZWL',

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
  jpy: 'JPY',
  cad: 'CAD',
  aud: 'AUD',
  chf: 'CHF',
  sar: 'SAR',
  qar: 'QAR',
};

/* -------------------------------------------------------------------------- */
/* GLOBAL CITIES / MARKET CENTERS                                             */
/* -------------------------------------------------------------------------- */

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

  karachi: 'Pakistan',
  lahore: 'Pakistan',
  islamabad: 'Pakistan',
  peshawar: 'Pakistan',

  delhi: 'India',
  'new delhi': 'India',
  mumbai: 'India',
  chennai: 'India',
  kolkata: 'India',
  ahmedabad: 'India',

  almaty: 'Kazakhstan',
  astana: 'Kazakhstan',

  moscow: 'Russia',
  'saint petersburg': 'Russia',
  novosibirsk: 'Russia',

  tashkent: 'Uzbekistan',
  samarkand: 'Uzbekistan',

  dubai: 'United Arab Emirates',
  'abu dhabi': 'United Arab Emirates',

  tehran: 'Iran',
  mashhad: 'Iran',

  istanbul: 'Turkey',
  ankara: 'Turkey',

  beijing: 'China',
  shanghai: 'China',
  guangzhou: 'China',
  shenzhen: 'China',

  london: 'United Kingdom',
  'new york': 'United States',
  chicago: 'United States',
  houston: 'United States',

  singapore: 'Singapore',
  jakarta: 'Indonesia',
  bangkok: 'Thailand',
  'ho chi minh': 'Vietnam',
  hanoi: 'Vietnam',
  seoul: 'South Korea',
  tokyo: 'Japan',
  osaka: 'Japan',

  frankfurt: 'Germany',
  hamburg: 'Germany',
  rotterdam: 'Netherlands',
  paris: 'France',
  milan: 'Italy',
  madrid: 'Spain',

  'cape town': 'South Africa',
  johannesburg: 'South Africa',
  lagos: 'Nigeria',
  nairobi: 'Kenya',
  cairo: 'Egypt',
  casablanca: 'Morocco',

  'sao paulo': 'Brazil',
  'são paulo': 'Brazil',
  'buenos aires': 'Argentina',
};

/* -------------------------------------------------------------------------- */
/* COMMODITIES                                                               */
/* -------------------------------------------------------------------------- */

const COMMODITIES = [
  'wheat',
  'flour',
  'rice',
  'sugar',
  'cooking oil',
  'sunflower oil',
  'palm oil',
  'soybean oil',
  'corn',
  'maize',
  'barley',
  'cotton',
  'tea',
  'coffee',
  'lentils',
  'chickpeas',
  'beans',
  'mung beans',
  'fertilizer',
  'urea',
  'diesel',
  'petrol',
  'gasoline',
  'cement',
  'steel',
  'aluminum',
  'aluminium',
  'copper',
  'gold',
  'cocoa',
  'onion',
  'potato',
  'tomato',
  'apples',
  'bananas',
  'chicken',
  'beef',
  'mutton',
  'milk',
  'eggs',
  'salt',
  'black pepper',
];

/* -------------------------------------------------------------------------- */
/* COMMODITY CATEGORIES                                                       */
/* -------------------------------------------------------------------------- */

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
  aluminium: 'Metals',
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

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(value: string): string {
  return value
    .replace(/[→➜➡]/g, ' to ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value: string): string {
  return value
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/-(\w)/g, (match, char) => {
      const lower = String(char).toLowerCase();

      if (['e', 'i', 'de', 'du', 'la', 'le'].includes(lower)) {
        return `-${lower}`;
      }

      return match;
    });
}

function canonicalCountry(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const alias = COUNTRY_ALIASES[normalized];

  if (alias) {
    return alias;
  }

  if (COUNTRIES.some((country) => country === normalized)) {
    return titleCase(normalized);
  }

  return null;
}

function currencyForCountry(country: string | null): string | null {
  if (!country) {
    return null;
  }

  return CURRENCIES[country.toLowerCase()] ?? null;
}

/* -------------------------------------------------------------------------- */
/* COMMODITY DETECTION                                                        */
/* -------------------------------------------------------------------------- */

function findCommodity(text: string): string | null {
  const lower = text.toLowerCase();

  const ordered = [...COMMODITIES].sort(
    (a, b) => b.length - a.length,
  );

  for (const commodity of ordered) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(commodity)}\\b`,
      'i',
    );

    if (pattern.test(lower)) {
      return commodity;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* COUNTRY DETECTION                                                          */
/* -------------------------------------------------------------------------- */

function findCountryMatches(text: string): CountryMatch[] {
  const lower = text.toLowerCase();

  const searchTerms = [
    ...COUNTRIES,
    ...Object.keys(COUNTRY_ALIASES),
  ].sort((a, b) => b.length - a.length);

  const matches: CountryMatch[] = [];

  for (const term of searchTerms) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(term)}\\b`,
      'gi',
    );

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(lower)) !== null) {
      const canonical =
        COUNTRY_ALIASES[term] ??
        titleCase(term);

      matches.push({
        canonical,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  matches.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }

    return (
      b.end -
      b.start -
      (a.end - a.start)
    );
  });

  const accepted: CountryMatch[] = [];

  for (const match of matches) {
    const overlaps = accepted.some(
      (existing) =>
        match.start < existing.end &&
        match.end > existing.start,
    );

    if (!overlaps) {
      accepted.push(match);
    }
  }

  return accepted.sort(
    (a, b) => a.start - b.start,
  );
}

function findCountries(text: string): string[] {
  const matches = findCountryMatches(text);
  const result: string[] = [];

  for (const match of matches) {
    const exists = result.some(
      (country) =>
        country.toLowerCase() ===
        match.canonical.toLowerCase(),
    );

    if (!exists) {
      result.push(match.canonical);
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* CITY DETECTION                                                             */
/* -------------------------------------------------------------------------- */

function findCity(text: string): CityHit | null {
  const lower = text.toLowerCase();

  const cityNames = Object.keys(CITIES).sort(
    (a, b) => b.length - a.length,
  );

  for (const city of cityNames) {
    const pattern = new RegExp(
      `\\b${escapeRegExp(city)}\\b`,
      'i',
    );

    if (pattern.test(lower)) {
      return {
        city: titleCase(city),
        country: CITIES[city],
      };
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* CURRENCY DETECTION                                                         */
/* -------------------------------------------------------------------------- */

function findCurrencies(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  const pairMatch = lower.match(
    /\b([a-z]{3})\s*\/\s*([a-z]{3})\b/i,
  );

  if (pairMatch) {
    found.push(pairMatch[1].toUpperCase());
    found.push(pairMatch[2].toUpperCase());
  }

  for (const key of Object.keys(CURRENCIES)) {
    if (key.length !== 3) {
      continue;
    }

    const pattern = new RegExp(
      `\\b${escapeRegExp(key)}\\b`,
      'i',
    );

    if (pattern.test(lower)) {
      found.push(CURRENCIES[key]);
    }
  }

  return [...new Set(found)];
}

/* -------------------------------------------------------------------------- */
/* PERIOD                                                                     */
/* -------------------------------------------------------------------------- */

function detectPeriod(text: string): string {
  const lower = text.toLowerCase();

  if (
    /\btoday\b|\bnow\b|\bdaily\b|\bcurrent\b/.test(
      lower,
    )
  ) {
    return 'today';
  }

  if (
    /\bweek\b|\bweekly\b/.test(
      lower,
    )
  ) {
    return '7days';
  }

  if (
    /\bmonth\b|\bmonthly\b/.test(
      lower,
    )
  ) {
    return '30days';
  }

  if (
    /\bquarter\b|\bquarterly\b/.test(
      lower,
    )
  ) {
    return '90days';
  }

  if (
    /\byear\b|\byearly\b|\bannual\b/.test(
      lower,
    )
  ) {
    return '365days';
  }

  return 'today';
}

/* -------------------------------------------------------------------------- */
/* OBJECTIVE                                                                  */
/* -------------------------------------------------------------------------- */

function detectObjective(text: string): string {
  const lower = text.toLowerCase();

  // Comparison must be detected FIRST.
  // This prevents "compare ... import ..." from becoming
  // an import workflow.
  if (
    /\bcompare\b|\bcomparison\b|\bversus\b|\bvs\.?\b|\bbetween\b/.test(
      lower,
    )
  ) {
    return 'compare';
  }

  if (
    /\bshould\s+we\s+import\b|\bimport\s+feasibility\b|\bimport\s+research\b|\bshould.*\bimport\b/.test(
      lower,
    )
  ) {
    return 'import_feasibility';
  }

  if (
    /\bimport\b.*\bfrom\b|\bimports?\b|\bimporting\b/.test(
      lower,
    )
  ) {
    return 'import_research';
  }

  if (
    /\breport\b|\bweekly\b|\bdaily\b|\bmonthly\b/.test(
      lower,
    )
  ) {
    return 'report';
  }

  if (
    /\bfx\b|\bcurrency\b|\bexchange\s+rate\b|\baffect\b.*\b(wheat|flour|oil|rice|commodity)\b/.test(
      lower,
    )
  ) {
    return 'fx_impact';
  }

  if (
    /\banalyze\b|\banalysis\b|\bmarket\b|\bprices?\b|\bprice\b/.test(
      lower,
    )
  ) {
    return 'market_analysis';
  }

  return 'market_analysis';
}

/* -------------------------------------------------------------------------- */
/* COMPARISON CONTEXT                                                         */
/* -------------------------------------------------------------------------- */

function detectComparisonContext(
  text: string,
  cityHit: CityHit | null,
): string | null {
  // A city is an explicit market context.
  if (cityHit) {
    return cityHit.country;
  }

  // Explicit:
  // "... for Afghanistan"
  // "... for the Afghanistan market"
  const marketPattern =
    /\bfor\s+(?:the\s+)?([a-z][a-z\s-]*?)(?:\s+market)?(?:[.!?,;:]|$)/i;

  const match = marketPattern.exec(text);

  if (match) {
    const candidate = match[1]
      .trim()
      .toLowerCase();

    const country = canonicalCountry(candidate);

    if (country) {
      return country;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* COMPARISON MARKETS                                                         */
/* -------------------------------------------------------------------------- */

function detectComparisonMarkets(
  text: string,
  countryMatches: CountryMatch[],
  comparisonContext: string | null,
): string[] {
  const uniqueCountries: string[] = [];

  for (const match of countryMatches) {
    const country = match.canonical;

    const alreadyAdded = uniqueCountries.some(
      (existing) =>
        existing.toLowerCase() ===
        country.toLowerCase(),
    );

    if (!alreadyAdded) {
      uniqueCountries.push(country);
    }
  }

  // Context country is NOT a comparison market.
  const candidates = uniqueCountries.filter(
    (country) =>
      !comparisonContext ||
      country.toLowerCase() !==
        comparisonContext.toLowerCase(),
  );

  /**
   * Explicit forms:
   *
   * between Russia and Kazakhstan
   * Russia vs Kazakhstan
   * Russia versus Kazakhstan
   */
  const explicitPatterns = [
    /\bbetween\s+([a-z][a-z\s-]+?)\s+(?:and|&)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;:]|\s+for\b|\s+in\b)/i,

    /\b([a-z][a-z\s-]+?)\s+(?:vs\.?|versus)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;:]|\s+for\b|\s+in\b)/i,

    /\b([a-z][a-z\s-]+?)\s+(?:and|&)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;:]|\s+for\b|\s+in\b)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = pattern.exec(text);

    if (!match) {
      continue;
    }

    const left = canonicalCountry(
      match[1].trim(),
    );

    const right = canonicalCountry(
      match[2].trim(),
    );

    if (
      left &&
      right &&
      left.toLowerCase() !==
        right.toLowerCase()
    ) {
      const pair = [left, right].filter(
        (country) =>
          !comparisonContext ||
          country.toLowerCase() !==
            comparisonContext.toLowerCase(),
      );

      if (pair.length >= 2) {
        return pair.slice(0, 2);
      }
    }
  }

  /**
   * Generic fallback:
   *
   * Russia, Kazakhstan, Afghanistan
   * -> Russia, Kazakhstan
   *
   * This is safe because the context country has already
   * been excluded.
   */
  return candidates.slice(0, 2);
}

/* -------------------------------------------------------------------------- */
/* IMPORT ROUTE                                                               */
/* -------------------------------------------------------------------------- */

function detectImportRoute(
  text: string,
  countryMatches: CountryMatch[],
  isComparison: boolean,
): {
  origin: string | null;
  destination: string | null;
} {
  // CRITICAL:
  // A comparison is never an import route.
  if (isComparison) {
    return {
      origin: null,
      destination: null,
    };
  }

  const normalized = normalizeText(text);

  /**
   * Strong explicit route:
   * from Russia to Afghanistan
   * from Russia into Afghanistan
   */
  const explicitRoutePatterns = [
    /\bfrom\s+([a-z][a-z\s-]+?)\s+(?:to|into|toward|towards)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;:]|\s+for\b|\s+with\b)/i,

    /\bfrom\s+([a-z][a-z\s-]+?)\s+(?:to|into|toward|towards)\s+([a-z][a-z\s-]+)/i,
  ];

  for (const pattern of explicitRoutePatterns) {
    const match = pattern.exec(normalized);

    if (!match) {
      continue;
    }

    const origin = canonicalCountry(
      match[1].trim(),
    );

    const destination = canonicalCountry(
      match[2].trim(),
    );

    if (origin || destination) {
      return {
        origin,
        destination,
      };
    }
  }

  const lower = normalized.toLowerCase();

  const isImportCommand =
    /\bimport\b|\bimports\b|\bimporting\b|\bimported\b/.test(
      lower,
    );

  if (
    !isImportCommand ||
    countryMatches.length < 2
  ) {
    return {
      origin: null,
      destination: null,
    };
  }

  const fromIndex = lower.indexOf(' from ');
  const toIndex = lower.indexOf(' to ');
  const intoIndex = lower.indexOf(' into ');

  const routeEndIndexes = [
    toIndex,
    intoIndex,
  ].filter(
    (index) => index !== -1,
  );

  const routeEnd =
    routeEndIndexes.length > 0
      ? Math.min(...routeEndIndexes)
      : -1;

  if (fromIndex !== -1) {
    const originStart = fromIndex;

    const originEnd =
      routeEnd > fromIndex
        ? routeEnd
        : lower.length;

    const originMatch =
      countryMatches.find(
        (match) =>
          match.start >= originStart &&
          match.end <= originEnd,
      );

    const destinationMatch =
      routeEnd > fromIndex
        ? countryMatches.find(
            (match) =>
              match.start >= routeEnd,
          )
        : null;

    return {
      origin:
        originMatch?.canonical ??
        null,

      destination:
        destinationMatch?.canonical ??
        null,
    };
  }

  /**
   * Fallback for:
   * Russia to Afghanistan
   */
  if (routeEnd !== -1) {
    const before = countryMatches.filter(
      (match) =>
        match.end <= routeEnd,
    );

    const after = countryMatches.filter(
      (match) =>
        match.start >= routeEnd,
    );

    return {
      origin:
        before.length > 0
          ? before[before.length - 1]
              .canonical
          : null,

      destination:
        after.length > 0
          ? after[0].canonical
          : null,
    };
  }

  return {
    origin: null,
    destination: null,
  };
}

/* -------------------------------------------------------------------------- */
/* PARSER                                                                     */
/* -------------------------------------------------------------------------- */

export function parseCommand(
  raw: string,
): ParsedIntent {
  const text = normalizeText(raw);

  if (!text) {
    return {
      commodity: null,
      origin: null,
      destination: null,
      city: null,
      market: null,
      currencies: ['USD'],
      period: 'today',
      objective: 'market_analysis',
      assumptions: [
        'Empty command — no market scope detected.',
      ],
      raw: '',
    };
  }

  const assumptions: string[] = [];

  const commodity = findCommodity(text);
  const cityHit = findCity(text);
  const countryMatches =
    findCountryMatches(text);
  const countries = findCountries(text);
  const currencyHits =
    findCurrencies(text);

  const objective =
    detectObjective(text);

  const period =
    detectPeriod(text);

  const isComparison =
    objective === 'compare';

  /* ---------------------------------------------------------------------- */
  /* COMPARISON                                                              */
  /* ---------------------------------------------------------------------- */

  let comparisonMarkets: string[] = [];
  let comparisonContext: string | null = null;

  if (isComparison) {
    comparisonContext =
      detectComparisonContext(
        text,
        cityHit,
      );

    comparisonMarkets =
      detectComparisonMarkets(
        text,
        countryMatches,
        comparisonContext,
      );
  }

  /* ---------------------------------------------------------------------- */
  /* IMPORT ROUTE                                                            */
  /* ---------------------------------------------------------------------- */

  const route =
    detectImportRoute(
      text,
      countryMatches,
      isComparison,
    );

  let origin =
    route.origin;

  let destination =
    route.destination;

  /**
   * For comparison:
   *
   * origin = null
   * destination = context only
   *
   * Russia/Kazakhstan are NOT treated as an import route.
   */
  if (isComparison) {
    origin = null;
    destination =
      comparisonContext;
  }

  /* ---------------------------------------------------------------------- */
  /* CITY / MARKET                                                           */
  /* ---------------------------------------------------------------------- */

  const city: string | null =
    cityHit?.city ??
    null;

  const market: string | null =
    city
      ? `${city} Market`
      : null;

  if (
    cityHit &&
    !destination
  ) {
    destination =
      cityHit.country;
  }

  /**
   * Single-country non-comparison command:
   * "Analyze wheat market in Afghanistan."
   */
  if (
    countries.length === 1 &&
    !destination &&
    !origin &&
    !isComparison
  ) {
    destination =
      countries[0];
  }

  /* ---------------------------------------------------------------------- */
  /* CURRENCIES                                                              */
  /* ---------------------------------------------------------------------- */

  let currencies = [
    ...currencyHits,
  ];

  const addCurrency =
    (country: string | null) => {
      const currency =
        currencyForCountry(country);

      if (
        currency &&
        !currencies.includes(currency)
      ) {
        currencies.push(currency);
      }
    };

  addCurrency(origin);
  addCurrency(destination);

  for (
    const comparisonMarket
    of comparisonMarkets
  ) {
    addCurrency(
      comparisonMarket,
    );
  }

  /**
   * USD remains the global normalization
   * currency unless explicitly present.
   */
  if (!currencies.includes('USD')) {
    currencies.push('USD');
  }

  currencies = [
    ...new Set(
      currencies.filter(
        (currency) =>
          typeof currency === 'string' &&
          currency.length === 3,
      ),
    ),
  ];

  /* ---------------------------------------------------------------------- */
  /* ASSUMPTIONS                                                             */
  /* ---------------------------------------------------------------------- */

  if (isComparison) {
    if (
      comparisonMarkets.length >= 2
    ) {
      assumptions.push(
        `Comparison markets: ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}.`,
      );
    } else if (
      comparisonMarkets.length === 1
    ) {
      assumptions.push(
        `Only one comparison market detected: ${comparisonMarkets[0]}.`,
      );
    } else {
      assumptions.push(
        'Comparison requested, but fewer than two comparison markets were detected.',
      );
    }

    if (comparisonContext) {
      assumptions.push(
        `Market context: ${comparisonContext}.`,
      );
    }

    if (
      comparisonMarkets.length >= 2
    ) {
      assumptions.push(
        'Comparison markets are independent market entities, not an import route.',
      );
    }
  } else {
    if (
      !destination &&
      !origin &&
      !city
    ) {
      assumptions.push(
        'No location specified — defaulting to global commodity market context.',
      );
    }

    if (
      commodity &&
      !origin &&
      !city &&
      !destination
    ) {
      assumptions.push(
        'No origin or city specified — analyzing global commodity market only.',
      );
    }
  }

  /* ---------------------------------------------------------------------- */
  /* RESULT                                                                  */
  /* ---------------------------------------------------------------------- */

  const parsedIntent =
    {
      commodity:
        commodity
          ? titleCase(
              commodity,
            )
          : null,

      origin,
      destination,

      city,
      market,

      currencies,
      period,
      objective,

      assumptions,

      raw: text,

      comparisonMarkets,
      comparisonContext,
    } as ExtendedParsedIntent;

  return parsedIntent;
}

/* -------------------------------------------------------------------------- */
/* INTENT LABEL                                                               */
/* -------------------------------------------------------------------------- */

export function intentLabel(
  intent: ParsedIntent,
): string {
  const extended =
    intent as ExtendedParsedIntent;

  const parts: string[] = [];

  if (intent.commodity) {
    parts.push(
      intent.commodity,
    );
  }

  /**
   * Comparison takes precedence over
   * origin/destination display.
   */
  if (
    extended.comparisonMarkets &&
    extended.comparisonMarkets.length >= 2
  ) {
    parts.push(
      `${extended.comparisonMarkets[0]} vs ${extended.comparisonMarkets[1]}`,
    );
  } else {
    if (intent.origin) {
      parts.push(
        `from ${intent.origin}`,
      );
    }

    if (intent.destination) {
      parts.push(
        `to ${intent.destination}`,
      );
    }
  }

  if (intent.city) {
    parts.push(
      `in ${intent.city}`,
    );
  } else if (
    extended.comparisonContext &&
    extended.comparisonMarkets &&
    extended.comparisonMarkets.length >= 2
  ) {
    parts.push(
      `for ${extended.comparisonContext}`,
    );
  }

  if (parts.length === 0) {
    parts.push(intent.raw);
  }

  return parts.join(' ');
}
