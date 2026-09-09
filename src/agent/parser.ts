// Global Market Intelligence command parser.
//
// Design principles:
// 1. Import route and comparison are DIFFERENT concepts.
// 2. Comparison markets are stored independently from origin/destination.
// 3. A market/country mentioned as context must not accidentally become
//    one side of a comparison.
// 4. Natural-language commands should work globally, not only for Afghanistan.
// 5. Existing ParsedIntent fields remain backward-compatible.
// 6. New comparison metadata is additive and does not require an import route.
//
// Examples:
//   "Compare wheat prices in Russia and Kazakhstan for Afghanistan."
//      comparisonMarkets = ["Russia", "Kazakhstan"]
//      comparisonContext = "Afghanistan"
//      origin = null
//      destination = "Afghanistan"
//
//   "Compare rice prices in India and Pakistan."
//      comparisonMarkets = ["India", "Pakistan"]
//      comparisonContext = null
//      origin = null
//      destination = null
//
//   "Research wheat imports from Russia to Afghanistan."
//      origin = "Russia"
//      destination = "Afghanistan"
//      comparisonMarkets = []
//
//   "Compare sunflower oil from Russia vs Kazakhstan for Kabul."
//      comparisonMarkets = ["Russia", "Kazakhstan"]
//      comparisonContext = "Afghanistan"
//      city = "Kabul"
//      origin = null
//      destination = "Afghanistan"

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

/**
 * Canonical global country names.
 *
 * The list intentionally contains broad international coverage.
 * Aliases/abbreviations are handled separately below.
 */
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

/**
 * Global aliases and abbreviations mapped to canonical country names.
 *
 * This prevents "USA", "US", "UAE", "UK", etc. from becoming
 * separate entities.
 */
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
  afghanistan: 'Afghanistan',

  czechia: 'Czech Republic',
  'republic of korea': 'South Korea',
  korea: 'South Korea',
  'dprk': 'North Korea',

  macedonia: 'North Macedonia',
  vietnam: 'Vietnam',
  vietnamese: 'Vietnam',
};

/**
 * Currency map for major/global markets.
 *
 * Unknown countries are simply not assigned a currency automatically.
 * This is safer than inventing a currency.
 */
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
  bosnia and herzegovina: 'BAM',
  brazil: 'BRL',
  bulgaria: 'BGN',
  cambodia: 'KHR',
  canada: 'CAD',
  chile: 'CLP',
  china: 'CNY',
  colombia: 'COP',
  croatia: 'EUR',
  czech republic: 'CZK',
  denmark: 'DKK',
  egypt: 'EGP',
  estonia: 'EUR',
  european union: 'EUR',
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
  new zealand: 'NZD',
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
  saudi arabia: 'SAR',
  serbia: 'RSD',
  singapore: 'SGD',
  slovakia: 'EUR',
  slovenia: 'EUR',
  south africa: 'ZAR',
  south korea: 'KRW',
  spain: 'EUR',
  sri lanka: 'LKR',
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

/**
 * Global/common cities and market centers.
 *
 * Country resolution is used only as market context.
 */
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
  moscow: 'Russia',
  frankfurt: 'Germany',
  hamburg: 'Germany',
  rotterdam: 'Netherlands',
  paris: 'France',
  milan: 'Italy',
  madrid: 'Spain',
  cape town: 'South Africa',
  johannesburg: 'South Africa',
  lagos: 'Nigeria',
  nairobi: 'Kenya',
  cairo: 'Egypt',
  casablanca: 'Morocco',
  sao_paulo: 'Brazil',
  'são paulo': 'Brazil',
  buenos_aires: 'Argentina',
  'buenos aires': 'Argentina',
};

/**
 * Commodities recognized by the parser.
 *
 * Long/multi-word commodities are checked before short terms.
 */
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

/**
 * Commodity categories.
 */
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

/**
 * Escape text before inserting into a RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes whitespace and separators.
 */
function normalizeText(value: string): string {
  return value
    .replace(/[→➜➡]/g, ' to ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical title case for display.
 */
function titleCase(s: string): string {
  return s
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/-(\w)/g, (m, c) => {
      return ['e', 'i', 'de', 'du', 'la', 'le'].includes(c.toLowerCase())
        ? `-${c.toLowerCase()}`
        : m;
    });
}

/**
 * Canonical country resolver.
 */
function canonicalCountry(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return null;

  const alias = COUNTRY_ALIASES[normalized];
  if (alias) return alias;

  if (COUNTRIES.some((country) => country === normalized)) {
    return titleCase(normalized);
  }

  return null;
}

/**
 * Finds commodities globally from the known commodity vocabulary.
 */
function findCommodity(text: string): string | null {
  const lower = text.toLowerCase();

  const ordered = [...COMMODITIES].sort(
    (a, b) => b.length - a.length,
  );

  for (const commodity of ordered) {
    const re = new RegExp(
      `\\b${escapeRegExp(commodity)}\\b`,
      'i',
    );

    if (re.test(lower)) {
      return commodity;
    }
  }

  return null;
}

/**
 * Finds country mentions while preserving their position in the command.
 *
 * This is important because comparison parsing needs ordered entities:
 *   Russia ... Kazakhstan ... Afghanistan
 */
function findCountryMatches(text: string): CountryMatch[] {
  const lower = text.toLowerCase();
  const aliases = Object.keys(COUNTRY_ALIASES);

  const searchTerms = [
    ...COUNTRIES,
    ...aliases,
  ].sort((a, b) => b.length - a.length);

  const matches: CountryMatch[] = [];

  for (const term of searchTerms) {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');

    let match: RegExpExecArray | null;

    while ((match = re.exec(lower)) !== null) {
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

  /**
   * Remove duplicates caused by overlapping aliases:
   * "United States" + "US", etc.
   */
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
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

  return accepted.sort((a, b) => a.start - b.start);
}

function findCountries(text: string): string[] {
  const matches = findCountryMatches(text);
  const found: string[] = [];

  for (const match of matches) {
    if (!found.some(
      (country) =>
        country.toLowerCase() === match.canonical.toLowerCase(),
    )) {
      found.push(match.canonical);
    }
  }

  return found;
}

/**
 * Finds a known city/market center.
 */
function findCity(text: string): CityHit | null {
  const lower = text.toLowerCase();

  const cityNames = Object.keys(CITIES).sort(
    (a, b) => b.length - a.length,
  );

  for (const city of cityNames) {
    const re = new RegExp(
      `\\b${escapeRegExp(city)}\\b`,
      'i',
    );

    if (re.test(lower)) {
      return {
        city: titleCase(city.replace(/_/g, ' ')),
        country: CITIES[city],
      };
    }
  }

  return null;
}

/**
 * Currency extraction.
 */
function findCurrencies(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  /**
   * Explicit FX pair, e.g. USD/AFN.
   */
  const pairMatch = lower.match(
    /\b([a-z]{3})\s*\/\s*([a-z]{3})\b/i,
  );

  if (pairMatch) {
    found.push(pairMatch[1].toUpperCase());
    found.push(pairMatch[2].toUpperCase());
  }

  /**
   * Explicit currency codes.
   */
  for (const key of Object.keys(CURRENCIES)) {
    if (key.length !== 3) continue;

    const re = new RegExp(
      `\\b${escapeRegExp(key)}\\b`,
      'i',
    );

    if (re.test(lower)) {
      found.push(CURRENCIES[key]);
    }
  }

  return [...new Set(found)];
}

/**
 * Period detector.
 */
function detectPeriod(text: string): string {
  const lower = text.toLowerCase();

  if (
    /\btoday\b|\bnow\b|\bdaily\b|\bcurrent\b/.test(lower)
  ) {
    return 'today';
  }

  if (/\bweek\b|\bweekly\b/.test(lower)) {
    return '7days';
  }

  if (/\bmonth\b|\bmonthly\b/.test(lower)) {
    return '30days';
  }

  if (/\bquarter\b|\bquarterly\b/.test(lower)) {
    return '90days';
  }

  if (/\byear\b|\byearly\b|\bannual\b/.test(lower)) {
    return '365days';
  }

  return 'today';
}

/**
 * Objective detector.
 *
 * Comparison is evaluated before generic "market", "price", or "import"
 * language so it cannot accidentally become an import workflow.
 */
function detectObjective(text: string): string {
  const lower = text.toLowerCase();

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

  if (
    /\bshould\s+we\s+import\b|
     \bimport\s+feasibility\b|
     \bimport\s+research\b|
     \bshould.*\bimport\b/i.test(lower)
  ) {
    return 'import_feasibility';
  }

  if (
    /\bimport\b.*\bfrom\b|
     \bimports?\b|
     \bimporting\b/i.test(lower)
  ) {
    return 'import_research';
  }

  if (
    /\breport\b|
     \bweekly\b|
     \bdaily\b|
     \bmonthly\b/i.test(lower)
  ) {
    return 'report';
  }

  if (
    /\bfx\b|
     \bcurrency\b|
     \bexchange\s+rate\b|
     \baffect\b.*\b(wheat|flour|oil|rice|commodity)\b/i.test(lower)
  ) {
    return 'fx_impact';
  }

  if (
    /\banalyze\b|
     \banalysis\b|
     \bmarket\b|
     \bprices?\b|
     \bprice\b/i.test(lower)
  ) {
    return 'market_analysis';
  }

  return 'market_analysis';
}

/**
 * Extracts an explicitly stated country/city market context.
 *
 * Supported examples:
 *   "... for Afghanistan"
 *   "... for the Afghanistan market"
 *   "... in Kabul"
 *   "... for Kabul"
 *
 * We deliberately DO NOT interpret every "in X" as context because:
 *   "prices in Russia and Kazakhstan"
 * contains the actual comparison markets.
 */
function detectComparisonContext(
  text: string,
  cityHit: CityHit | null,
  countryMatches: CountryMatch[],
): string | null {
  /**
   * A city is always safe to use as geographic context.
   */
  if (cityHit) {
    return cityHit.country;
  }

  const lower = text.toLowerCase();

  /**
   * Prefer explicit "for <country>" or
   * "for the <country> market".
   */
  const explicitForPatterns = [
    /\bfor\s+(?:the\s+)?([a-z][a-z\s-]+?)\s+market\b/i,
    /\bfor\s+(?:the\s+)?([a-z][a-z\s-]+?)\b/i,
  ];

  for (const pattern of explicitForPatterns) {
    const match = pattern.exec(text);

    if (!match) continue;

    const rawContext = match[1]
      .trim()
      .replace(/[.,!?;:]$/, '')
      .toLowerCase();

    const canonical = canonicalCountry(rawContext);

    if (canonical) {
      return canonical;
    }
  }

  /**
   * Fallback:
   * If "for <country>" was not matched because punctuation or wording
   * was unusual, inspect country occurrences that appear near the end
   * of the command after a comparison phrase.
   */
  const compareMatch =
    /\b(?:compare|comparison|versus|vs\.?|between)\b/i.exec(lower);

  if (compareMatch) {
    const afterComparison = lower.slice(compareMatch.index);

    const hasExplicitContextWord =
      /\bfor\b|\bwithin\b|\bacross\b/i.test(afterComparison);

    if (hasExplicitContextWord) {
      const lastCountry = countryMatches[countryMatches.length - 1];

      if (lastCountry) {
        const beforeLast = lower.slice(
          lastCountry.start,
          lastCountry.end,
        );

        if (beforeLast) {
          return lastCountry.canonical;
        }
      }
    }
  }

  return null;
}

/**
 * Extracts the import route for non-comparison commands.
 *
 * Examples:
 *   from Russia to Afghanistan
 *   from Russia into Afghanistan
 *   Russia -> Afghanistan
 *
 * Comparison commands are explicitly excluded from this logic.
 */
function detectImportRoute(
  text: string,
  countries: string[],
  countryMatches: CountryMatch[],
  isComparison: boolean,
): {
  origin: string | null;
  destination: string | null;
} {
  if (isComparison) {
    return {
      origin: null,
      destination: null,
    };
  }

  const normalized = normalizeText(text);

  /**
   * Strong explicit route patterns.
   */
  const routePatterns = [
    /\bfrom\s+([a-z][a-z\s-]+?)\s+(?:to|into|toward|towards)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;])/i,
    /\bfrom\s+([a-z][a-z\s-]+?)\s+(?:to|into|toward|towards)\s+([a-z][a-z\s-]+)/i,
  ];

  for (const pattern of routePatterns) {
    const match = pattern.exec(normalized);

    if (!match) continue;

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

  /**
   * Fall back to ordered country mentions ONLY when the command clearly
   * expresses an import route.
   */
  const lower = normalized.toLowerCase();

  const importIntent =
    /\bimport\b|\bimports\b|\bimporting\b|\bimported\b/i.test(lower);

  if (!importIntent || countryMatches.length < 2) {
    return {
      origin: null,
      destination: null,
    };
  }

  const fromIndex = lower.indexOf(' from ');
  const toIndex = lower.indexOf(' to ');
  const intoIndex = lower.indexOf(' into ');

  const routeEndCandidates = [
    toIndex,
    intoIndex,
  ].filter((index) => index !== -1);

  const routeEnd =
    routeEndCandidates.length > 0
      ? Math.min(...routeEndCandidates)
      : -1;

  if (fromIndex !== -1) {
    const originSegment = lower.slice(
      fromIndex,
      routeEnd > fromIndex ? routeEnd : lower.length,
    );

    const originMatch = countryMatches.find((match) =>
      originSegment.includes(
        lower.slice(match.start, match.end),
      ),
    );

    const destinationMatch =
      routeEnd > fromIndex
        ? countryMatches.find(
            (match) => match.start >= routeEnd,
          )
        : null;

    return {
      origin: originMatch?.canonical ?? null,
      destination: destinationMatch?.canonical ?? null,
    };
  }

  /**
   * Last fallback for explicit "A to B" route syntax.
   */
  if (routeEndCandidates.length > 0) {
    const routeEnd = Math.min(...routeEndCandidates);

    const before = countryMatches.filter(
      (match) => match.end <= routeEnd,
    );

    const after = countryMatches.filter(
      (match) => match.start >= routeEnd,
    );

    return {
      origin:
        before.length > 0
          ? before[before.length - 1].canonical
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

/**
 * Extract comparison markets independently from import route.
 *
 * Priority:
 * 1. Explicit comparison syntax.
 * 2. Country mentions excluding market context.
 *
 * Supported:
 *   Russia and Kazakhstan
 *   Russia vs Kazakhstan
 *   Russia versus Kazakhstan
 *   Russia with Kazakhstan
 *   between Russia and Kazakhstan
 */
function detectComparisonMarkets(
  text: string,
  countryMatches: CountryMatch[],
  comparisonContext: string | null,
): string[] {
  const lower = text.toLowerCase();

  /**
   * Remove the context country before selecting comparison candidates.
   */
  const candidates = countryMatches
    .map((match) => match.canonical)
    .filter(
      (country, index, all) =>
        all.findIndex(
          (c) => c.toLowerCase() === country.toLowerCase(),
        ) === index,
    )
    .filter(
      (country) =>
        !comparisonContext ||
        country.toLowerCase() !== comparisonContext.toLowerCase(),
    );

  /**
   * Explicit pair structure.
   */
  const comparisonPairPatterns = [
    /\bbetween\b[\s\S]*?\b([a-z][a-z\s-]+?)\s+(?:and|&)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;]|\s+for\b|\s+in\b)/i,

    /\b([a-z][a-z\s-]+?)\s+(?:vs\.?|versus)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;]|\s+for\b|\s+in\b)/i,

    /\b([a-z][a-z\s-]+?)\s+(?:and|&)\s+([a-z][a-z\s-]+?)(?=$|[.,!?;]|\s+for\b|\s+in\b)/i,
  ];

  for (const pattern of comparisonPairPatterns) {
    const match = pattern.exec(text);

    if (!match) continue;

    const left = canonicalCountry(
      match[1].trim(),
    );

    const right = canonicalCountry(
      match[2].trim(),
    );

    if (
      left &&
      right &&
      left.toLowerCase() !== right.toLowerCase()
    ) {
      return [left, right];
    }
  }

  /**
   * Most reliable generic fallback:
   *
   * The first two distinct countries that are not the context
   * are the comparison markets.
   *
   * Example:
   * Russia, Kazakhstan, Afghanistan
   * -> Russia, Kazakhstan
   */
  return candidates.slice(0, 2);
}

/**
 * Adds currency for known country.
 */
function currencyForCountry(country: string | null): string | null {
  if (!country) return null;

  return CURRENCIES[country.toLowerCase()] ?? null;
}

export function parseCommand(raw: string): ParsedIntent {
  const text = normalizeText(raw);

  const assumptions: string[] = [];

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
      assumptions: ['Empty command — no market scope detected.'],
      raw: '',
    };
  }

  const commodity = findCommodity(text);
  const cityHit = findCity(text);
  const countryMatches = findCountryMatches(text);
  const countries = findCountries(text);
  const currencyHits = findCurrencies(text);

  const objective = detectObjective(text);
  const period = detectPeriod(text);

  const isComparison = objective === 'compare';

  /**
   * ============================================================
   * COMPARISON
   * ============================================================
   */
  let comparisonMarkets: string[] = [];
  let comparisonContext: string | null = null;

  if (isComparison) {
    comparisonContext = detectComparisonContext(
      text,
      cityHit,
      countryMatches,
    );

    comparisonMarkets = detectComparisonMarkets(
      text,
      countryMatches,
      comparisonContext,
    );
  }

  /**
   * ============================================================
   * IMPORT ROUTE
   * ============================================================
   *
   * For Comparison:
   * origin = null
   * destination = context only
   *
   * This is the critical separation.
   */
  const route = detectImportRoute(
    text,
    countries,
    countryMatches,
    isComparison,
  );

  let origin = route.origin;
  let destination = route.destination;

  /**
   * Comparison context becomes destination/context for existing
   * downstream code, but it is NEVER treated as import origin.
   */
  if (isComparison) {
    origin = null;
    destination = comparisonContext;
  }

  /**
   * City is independent of route.
   */
  const city: string | null =
    cityHit?.city ?? null;

  const market: string | null =
    city ? `${city} Market` : null;

  /**
   * If a city is present, its country is a geographic context.
   */
  if (cityHit && !destination) {
    destination = cityHit.country;
  }

  /**
   * If only one country is present and this isn't a comparison
   * or explicit route, treat it as a destination/context.
   */
  if (
    countries.length === 1 &&
    !destination &&
    !origin &&
    !isComparison
  ) {
    destination = countries[0];
  }

  /**
   * ============================================================
   * CURRENCIES
   * ============================================================
   *
   * Comparison currencies are gathered independently.
   */
  let currencies = [...currencyHits];

  if (origin) {
    const currency = currencyForCountry(origin);

    if (currency && !currencies.includes(currency)) {
      currencies.push(currency);
    }
  }

  if (destination) {
    const currency = currencyForCountry(destination);

    if (currency && !currencies.includes(currency)) {
      currencies.push(currency);
    }
  }

  for (const comparisonMarket of comparisonMarkets) {
    const currency = currencyForCountry(comparisonMarket);

    if (currency && !currencies.includes(currency)) {
      currencies.push(currency);
    }
  }

  /**
   * USD is a safe global reporting currency.
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

  /**
   * ============================================================
   * ASSUMPTIONS
   * ============================================================
   */
  if (!commodity) {
    /**
     * FX-only and other non-commodity workflows may legitimately
     * have no commodity.
     */
  }

  if (isComparison) {
    if (comparisonMarkets.length >= 2) {
      assumptions.push(
        `Comparison markets: ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}.`,
      );
    } else if (comparisonMarkets.length === 1) {
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
  } else {
    if (!destination && !origin && !city) {
      assumptions.push(
        'No location specified — defaulting to global commodity market context.',
      );
    }

    if (commodity && !origin && !city && !destination) {
      assumptions.push(
        'No origin or city specified — analyzing global commodity market only.',
      );
    }
  }

  /**
   * Explicitly document route semantics.
   */
  if (
    isComparison &&
    comparisonMarkets.length >= 2 &&
    !origin
  ) {
    assumptions.push(
      'Comparison does not imply an import route between the comparison markets.',
    );
  }

  /**
   * ============================================================
   * RETURN
   * ============================================================
   *
   * comparisonMarkets and comparisonContext are additive metadata.
   * Existing ParsedIntent fields stay intact for backward compatibility.
   */
  const parsedIntent: ExtendedParsedIntent = {
    commodity: commodity
      ? titleCase(commodity)
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
  };

  return parsedIntent;
}

export function intentLabel(
  intent: ParsedIntent,
): string {
  const extended = intent as ExtendedParsedIntent;

  const parts: string[] = [];

  if (intent.commodity) {
    parts.push(intent.commodity);
  }

  if (
    extended.comparisonMarkets &&
    extended.comparisonMarkets.length >= 2
  ) {
    parts.push(
      `${extended.comparisonMarkets[0]} vs ${extended.comparisonMarkets[1]}`,
    );
  } else {
    if (intent.origin) {
      parts.push(`from ${intent.origin}`);
    }

    if (intent.destination) {
      parts.push(`to ${intent.destination}`);
    }
  }

  if (intent.city) {
    parts.push(`in ${intent.city}`);
  } else if (
    extended.comparisonContext &&
    extended.comparisonMarkets &&
    extended.comparisonMarkets.length >= 2
  ) {
    parts.push(`for ${extended.comparisonContext}`);
  }

  if (parts.length === 0) {
    parts.push(intent.raw);
  }

  return parts.join(' ');
}
