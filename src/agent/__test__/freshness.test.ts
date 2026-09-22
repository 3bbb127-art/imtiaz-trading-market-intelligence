// Unit tests for Research Source Verification & Publication Date Relevance
// Run with: npx tsx src/agent/__test__/freshness.test.ts

import { freshnessOf } from '../../lib/format';
import { buildFindings, type EngineInput } from '../engines';
import type { ResearchProviderResult } from '../../lib/types';
import { parseCommand } from '../parser';

function assert(name: string, condition: boolean, details: string): void {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}: ${details}`);
  if (!condition) process.exitCode = 1;
}

console.log('\n=== TEST 1: Centralized Freshness Calculation ===');

const now = Date.now();
const MS_PER_DAY = 86400000;

const date3DaysAgo = new Date(now - 3 * MS_PER_DAY).toISOString().slice(0, 10);
const date15DaysAgo = new Date(now - 15 * MS_PER_DAY).toISOString().slice(0, 10);
const date45DaysAgo = new Date(now - 45 * MS_PER_DAY).toISOString().slice(0, 10);

assert('<= 7 days -> CURRENT', freshnessOf(date3DaysAgo) === 'CURRENT', `got "${freshnessOf(date3DaysAgo)}" for ${date3DaysAgo}`);
assert('8-30 days -> RECENT', freshnessOf(date15DaysAgo) === 'RECENT', `got "${freshnessOf(date15DaysAgo)}" for ${date15DaysAgo}`);
assert('> 30 days -> STALE', freshnessOf(date45DaysAgo) === 'STALE', `got "${freshnessOf(date45DaysAgo)}" for ${date45DaysAgo}`);
assert('missing date -> UNKNOWN', freshnessOf(undefined) === 'UNKNOWN', `got "${freshnessOf(undefined)}"`);
assert('null date -> UNKNOWN', freshnessOf(null) === 'UNKNOWN', `got "${freshnessOf(null)}"`);
assert('invalid date string -> UNKNOWN', freshnessOf('invalid-date-string') === 'UNKNOWN', `got "${freshnessOf('invalid-date-string')}"`);

console.log('\n=== TEST 2: Research Consumer Freshness & Observation Date Propagation ===');

const researchWithDates: ResearchProviderResult[] = [
  {
    title: 'Recent Wheat Market Update in Chicago',
    url: 'https://example.com/recent-wheat',
    snippet: 'Chicago wheat price USD 220/MT. Supply normal. Demand strong.',
    source_type: 'news',
    published_date: date3DaysAgo,
  },
  {
    title: 'Recent Wheat Market Analysis',
    url: 'https://example.com/mid-wheat',
    snippet: 'Wheat price USD 225/MT in Chicago.',
    source_type: 'news',
    published_date: date15DaysAgo,
  },
  {
    title: 'Old Wheat Market Report',
    url: 'https://example.com/old-wheat',
    snippet: 'Chicago wheat price USD 230/MT in earlier trading.',
    source_type: 'news',
    published_date: date45DaysAgo,
  },
  {
    title: 'Undated Wheat Report',
    url: 'https://example.com/undated-wheat',
    snippet: 'Chicago wheat price USD 215/MT.',
    source_type: 'news',
    published_date: null,
  },
];

const input: EngineInput = {
  commodity: 'Wheat',
  origin: null,
  destination: null,
  city: 'Chicago',
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: researchWithDates,
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};

const findings = buildFindings(input);

// Check price points freshness and observation_date
const pricePoints = findings.price_points;
console.log('Extracted price points count:', pricePoints.length);

const recentPoint = pricePoints.find((p) => p.source.includes('recent-wheat'));
const midPoint = pricePoints.find((p) => p.source.includes('mid-wheat'));
const oldPoint = pricePoints.find((p) => p.source.includes('old-wheat'));
const undatedPoint = pricePoints.find((p) => p.source.includes('undated-wheat'));

assert('Recent research price point -> CURRENT', recentPoint?.freshness === 'CURRENT', `got "${recentPoint?.freshness}"`);
assert('Recent research observation date = published_date', recentPoint?.observation_date === date3DaysAgo, `got "${recentPoint?.observation_date}"`);

assert('Mid-age research price point -> RECENT', midPoint?.freshness === 'RECENT', `got "${midPoint?.freshness}"`);
assert('Mid-age research observation date = published_date', midPoint?.observation_date === date15DaysAgo, `got "${midPoint?.observation_date}"`);

assert('Old research price point -> STALE', oldPoint?.freshness === 'STALE', `got "${oldPoint?.freshness}"`);
assert('Old research observation date = published_date', oldPoint?.observation_date === date45DaysAgo, `got "${oldPoint?.observation_date}"`);

assert('Undated research price point -> UNKNOWN freshness', undatedPoint?.freshness === 'UNKNOWN', `got "${undatedPoint?.freshness}"`);
assert('Undated research observation date is undefined (NOT fake today)', undatedPoint?.observation_date === undefined, `got "${undatedPoint?.observation_date}"`);

// Check DataSource freshness in findings.sources
const recentSource = findings.sources.find((s) => s.url?.includes('recent-wheat'));
const oldSource = findings.sources.find((s) => s.url?.includes('old-wheat'));
const undatedSource = findings.sources.find((s) => s.url?.includes('undated-wheat'));

assert('Source list: recent source -> CURRENT', recentSource?.freshness === 'CURRENT', `got "${recentSource?.freshness}"`);
assert('Source list: old source -> STALE', oldSource?.freshness === 'STALE', `got "${oldSource?.freshness}"`);
assert('Source list: undated source -> UNKNOWN', undatedSource?.freshness === 'UNKNOWN', `got "${undatedSource?.freshness}"`);

console.log('\n=== TEST 3: Global Scope & Comparison Behavior Regression ===');

const comparisonCommand = 'Compare wheat prices between Russia and Kazakhstan';
const comparisonIntent = parseCommand(comparisonCommand);

assert('Comparison intent parsing', comparisonIntent.objective === 'compare' && comparisonIntent.comparisonMarkets.length === 2, `markets: ${comparisonIntent.comparisonMarkets.join(', ')}`);

const comparisonInput: EngineInput = {
  commodity: 'Wheat',
  origin: null,
  destination: null,
  city: null,
  comparisonMarkets: ['Russia', 'Kazakhstan'],
  objective: 'compare',
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Russia wheat FOB USD 220/MT',
      url: 'https://example.com/russia-wheat',
      snippet: 'Russian wheat export price at USD 220 per ton FOB Black Sea.',
      source_type: 'news',
      published_date: date3DaysAgo,
    },
    {
      title: 'Kazakhstan wheat FOB USD 210/MT',
      url: 'https://example.com/kazakhstan-wheat',
      snippet: 'Kazakhstan wheat export price at USD 210 per ton.',
      source_type: 'news',
      published_date: date15DaysAgo,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};

const comparisonFindings = buildFindings(comparisonInput);

assert('Comparison finds points for both markets', comparisonFindings.price_points.length >= 2, `got ${comparisonFindings.price_points.length} points`);
assert('Comparison recommendation is MONITOR or NEED MORE DATA', comparisonFindings.recommendation === 'MONITOR' || comparisonFindings.recommendation === 'NEED MORE DATA', `got "${comparisonFindings.recommendation}"`);

console.log('\n=== ALL FRESHNESS TESTS SUMMARY ===');
if (process.exitCode) {
  console.log('TEST SUITE FAILED — see assertion details above.');
} else {
  console.log('TEST SUITE PASSED — all freshness and source verification assertions passed.');
}
