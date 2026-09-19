// Demo test: Rice import from India to Afghanistan, target city Mazar-e-Sharif
// Simulates: no stored market data, FX provider 502, web research available
// Run: npx tsx src/agent/__test__/rice-demo.ts
import { parseCommand } from '../parser';
import { buildFindings, evaluationEngine, type RawMarketRow, type EngineInput } from '../engines';
import type { ResearchProviderResult } from '../../lib/types';

function assert(name: string, condition: boolean, details: string): void {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}: ${details}`);
  if (!condition) process.exitCode = 1;
}

// ---- STEP 1: Parse the exact demo command ----
console.log('\n=== STEP 1: Command Parsing ===');
const command = `Commodity: Rice
Origin: India
Destination: Afghanistan
Target City/Market: Mazar-e-Sharif`;

const intent = parseCommand(command);
console.log('Parsed:', JSON.stringify({ commodity: intent.commodity, origin: intent.origin, destination: intent.destination, city: intent.city }, null, 2));

assert('Origin = India', intent.origin === 'India', `got "${intent.origin}"`);
assert('Destination = Afghanistan', intent.destination === 'Afghanistan', `got "${intent.destination}"`);
assert('City = Mazar-e-Sharif', intent.city === 'Mazar-e-Sharif', `got "${intent.city}"`);
assert('Commodity = Rice', intent.commodity === 'Rice', `got "${intent.commodity}"`);

// ---- STEP 1B: Global Parser Verification Suite ----
console.log('\n=== STEP 1B: Global Parser Verification Suite ===');

// Test 1: Commodity + City
const p1 = parseCommand('wheat in Chicago');
assert('Parser T1 (Commodity+City): wheat', p1.commodity === 'Wheat', `got "${p1.commodity}"`);
assert('Parser T1 (Commodity+City): Chicago', p1.city === 'Chicago', `got "${p1.city}"`);
assert('Parser T1 (Commodity+City): no origin', p1.origin === null, `got "${p1.origin}"`);

// Test 2: Import Route
const p2 = parseCommand('wheat Russia to Iran');
assert('Parser T2 (Route): wheat', p2.commodity === 'Wheat', `got "${p2.commodity}"`);
assert('Parser T2 (Route): Russia', p2.origin === 'Russia', `got "${p2.origin}"`);
assert('Parser T2 (Route): Iran', p2.destination === 'Iran', `got "${p2.destination}"`);

// Test 3: Route + City
const p3 = parseCommand('sunflower oil Russia to Afghanistan in Kabul');
assert('Parser T3 (Route+City): sunflower oil', p3.commodity === 'Sunflower Oil', `got "${p3.commodity}"`);
assert('Parser T3 (Route+City): Russia', p3.origin === 'Russia', `got "${p3.origin}"`);
assert('Parser T3 (Route+City): Afghanistan', p3.destination === 'Afghanistan', `got "${p3.destination}"`);
assert('Parser T3 (Route+City): Kabul', p3.city === 'Kabul', `got "${p3.city}"`);

// Test 4: Country Comparison
const p4 = parseCommand('compare rice prices in India and Pakistan');
assert('Parser T4 (Comparison): rice', p4.commodity === 'Rice', `got "${p4.commodity}"`);
assert('Parser T4 (Comparison): India & Pakistan', p4.comparisonMarkets.includes('India') && p4.comparisonMarkets.includes('Pakistan'), `got ${JSON.stringify(p4.comparisonMarkets)}`);
assert('Parser T4 (Comparison): no origin', p4.origin === null, `got "${p4.origin}"`);

// Test 5: Global Comparison
const p5 = parseCommand('compare wheat prices in Russia and Kazakhstan');
assert('Parser T5 (Global Comparison): wheat', p5.commodity === 'Wheat', `got "${p5.commodity}"`);
assert('Parser T5 (Global Comparison): Russia & Kazakhstan', p5.comparisonMarkets.includes('Russia') && p5.comparisonMarkets.includes('Kazakhstan'), `got ${JSON.stringify(p5.comparisonMarkets)}`);
assert('Parser T5 (Global Comparison): no origin', p5.origin === null, `got "${p5.origin}"`);

// Test 6: Commodity Only
const p6 = parseCommand('wheat price trend');
assert('Parser T6 (Commodity Only): wheat', p6.commodity === 'Wheat', `got "${p6.commodity}"`);
assert('Parser T6 (Commodity Only): no origin', p6.origin === null, `got "${p6.origin}"`);
assert('Parser T6 (Commodity Only): no destination', p6.destination === null, `got "${p6.destination}"`);

// Test 7: City / Market
const p7 = parseCommand('rice prices in Mumbai');
assert('Parser T7 (City): rice', p7.commodity === 'Rice', `got "${p7.commodity}"`);
assert('Parser T7 (City): Mumbai', p7.city === 'Mumbai', `got "${p7.city}"`);
assert('Parser T7 (City): no origin', p7.origin === null, `got "${p7.origin}"`);

// Test 8: Global Trade Routes
const p8a = parseCommand('corn Brazil to Egypt');
assert('Parser T8a (Brazil to Egypt): Corn', p8a.commodity === 'Corn', `got "${p8a.commodity}"`);
assert('Parser T8a (Brazil to Egypt): Brazil', p8a.origin === 'Brazil', `got "${p8a.origin}"`);
assert('Parser T8a (Brazil to Egypt): Egypt', p8a.destination === 'Egypt', `got "${p8a.destination}"`);

const p8b = parseCommand('copper Chile to China');
assert('Parser T8b (Chile to China): Copper', p8b.commodity === 'Copper', `got "${p8b.commodity}"`);
assert('Parser T8b (Chile to China): Chile', p8b.origin === 'Chile', `got "${p8b.origin}"`);
assert('Parser T8b (Chile to China): China', p8b.destination === 'China', `got "${p8b.destination}"`);

const p8c = parseCommand('crude oil Saudi Arabia to India');
assert('Parser T8c (Saudi Arabia to India): Crude Oil', p8c.commodity === 'Crude Oil', `got "${p8c.commodity}"`);
assert('Parser T8c (Saudi Arabia to India): Saudi Arabia', p8c.origin === 'Saudi Arabia', `got "${p8c.origin}"`);
assert('Parser T8c (Saudi Arabia to India): India', p8c.destination === 'India', `got "${p8c.destination}"`);

const p8d = parseCommand('compare steel prices in Germany and Turkey');
assert('Parser T8d (Germany & Turkey): Steel', p8d.commodity === 'Steel', `got "${p8d.commodity}"`);
assert('Parser T8d (Germany & Turkey): Germany & Turkey', p8d.comparisonMarkets.includes('Germany') && p8d.comparisonMarkets.includes('Turkey'), `got ${JSON.stringify(p8d.comparisonMarkets)}`);
assert('Parser T8d (Germany & Turkey): no origin', p8d.origin === null, `got "${p8d.origin}"`);

// ---- STEP 2: Simulate the full pipeline with no stored data, FX 502 ----
console.log('\n=== STEP 2: Simulate pipeline (no stored data, FX 502) ===');

const marketRows: RawMarketRow[] = []; // No stored market data for this demo

// Simulate web research results — India rice prices, global rice market, Afghanistan food security
const researchResults: ResearchProviderResult[] = [
  {
    title: 'India rice export prices stable at USD 520/ton',
    url: 'https://example.com/india-rice-1',
    snippet: 'India rice export prices remain stable at USD 520 per ton for basmati. Strong demand from African and Asian buyers. Supply is abundant with record production.',
    source_type: 'news',
    data_status: 'REPORTED',
    confidence: 'MEDIUM',
    freshness: 'CURRENT',
  },
  {
    title: 'Afghanistan food security update: rice demand strong',
    url: 'https://example.com/afg-rice-1',
    snippet: 'Rice demand in Afghanistan remains strong with rising consumption. Imports from India and Pakistan continue to meet domestic shortfall. Prices stable in Kabul markets.',
    source_type: 'news',
    data_status: 'REPORTED',
    confidence: 'MEDIUM',
    freshness: 'CURRENT',
  },
  {
    title: 'Global rice market outlook 2026',
    url: 'https://example.com/global-rice',
    snippet: 'Global rice production at record highs. Vietnam rice at USD 480/ton. Thailand rice at USD 490/ton. Ample supplies expected to keep prices stable.',
    source_type: 'news',
    data_status: 'REPORTED',
    confidence: 'MEDIUM',
    freshness: 'CURRENT',
  },
  {
    title: 'Mazar-e-Sharif market report',
    url: 'https://example.com/mazar-rice',
    snippet: 'Rice prices in Mazar-e-Sharif markets at AFN 85 per kg. Demand steady. Supply normal with regular imports from India.',
    source_type: 'news',
    data_status: 'REPORTED',
    confidence: 'MEDIUM',
    freshness: 'CURRENT',
  },
];

// FX provider returned 502 — no live FX rates
const fxRates: EngineInput['fxRates'] = [];

const input: EngineInput = {
  commodity: intent.commodity,
  origin: intent.origin,
  destination: intent.destination,
  city: intent.city,
  currencies: intent.currencies,
  marketRows,
  fxRates,
  researchResults,
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
  researchMessage: undefined,
};

// ---- STEP 3: Build findings ----
console.log('\n=== STEP 3: Build Findings ===');
const findings = buildFindings(input);

console.log('Price points:');
for (const p of findings.price_points) {
  console.log(`  ${p.location} | ${p.currency} ${p.price}/${p.unit} | USD/MT: ${p.normalized_price_usd?.toFixed(2)} | source: ${p.source}`);
}

// Verify no price point is mislabeled as Mazar unless it actually mentions Mazar
const mazarPoints = findings.price_points.filter((p) => p.location.toLowerCase().includes('mazar'));
const indiaPoints = findings.price_points.filter((p) => p.location.toLowerCase().includes('india'));
const vietnamPoints = findings.price_points.filter((p) => p.location.toLowerCase().includes('vietnam'));
const globalPoints = findings.price_points.filter((p) => p.location.toLowerCase().includes('web research (global)'));

console.log(`\nLocation breakdown: Mazar=${mazarPoints.length}, India=${indiaPoints.length}, Vietnam=${vietnamPoints.length}, Global=${globalPoints.length}`);

assert('India price labeled as India', indiaPoints.length > 0, `found ${indiaPoints.length} India points`);
assert('Vietnam price NOT labeled as Mazar', vietnamPoints.length > 0 && !vietnamPoints.some((p) => p.location.toLowerCase().includes('mazar')), `Vietnam points: ${vietnamPoints.map((p) => p.location).join(', ')}`);
assert('Mazar point comes from Mazar research', mazarPoints.length > 0 && mazarPoints.every((p) => p.source.includes('mazar-rice')), `Mazar sources: ${mazarPoints.map((p) => p.source).join(', ')}`);

// ---- STEP 4: Check supply/demand extraction ----
console.log('\n=== STEP 4: Supply/Demand ===');
console.log(`Supply: ${findings.supply}`);
console.log(`Demand: ${findings.demand}`);

assert('Supply is not Unknown (research has supply signals)', findings.supply !== 'Unknown', `got "${findings.supply}"`);
assert('Demand is not Unknown (research has demand signals)', findings.demand !== 'Unknown', `got "${findings.demand}"`);

// ---- STEP 5: FX situation ----
console.log('\n=== STEP 5: FX Situation ===');
console.log(`FX situation: ${findings.fx_situation.slice(0, 120)}...`);
assert('FX situation mentions ESTIMATED', findings.fx_situation.includes('ESTIMATED'), `text: "${findings.fx_situation.slice(0, 100)}"`);
assert('FX situation mentions unavailable or fallback', findings.fx_situation.includes('unavailable') || findings.fx_situation.includes('fallback'), `text: "${findings.fx_situation.slice(0, 100)}"`);

// ---- STEP 6: Data gaps ----
console.log('\n=== STEP 6: Data Gaps ===');
console.log(`Data gaps: ${findings.data_gaps.length}`);
for (const g of findings.data_gaps) console.log(`  - ${g}`);

assert('Data gaps mention FX fallback', findings.data_gaps.some((g) => /fx|fallback|estimated/i.test(g)), `gaps: ${findings.data_gaps.join('; ')}`);
assert('Data gaps mention no stored data', findings.data_gaps.some((g) => /stored|market observation/i.test(g)), `gaps: ${findings.data_gaps.join('; ')}`);

// ---- STEP 7: Evaluation ===
console.log('\n=== STEP 7: Evaluation ===');
const evaluation = evaluationEngine(input, findings);

console.log(`Opportunity Score: ${evaluation.opportunity_score}/100`);
console.log(`Recommendation: ${evaluation.recommendation}`);
console.log(`Confidence: ${evaluation.confidence_level}`);
console.log(`Demand: ${evaluation.demand_assessment.slice(0, 80)}`);
console.log(`Supply: ${evaluation.supply_assessment.slice(0, 80)}`);
console.log(`Price: ${evaluation.price_attractiveness.slice(0, 80)}`);
console.log(`Data gaps: ${evaluation.data_gaps.length}`);

assert('Evaluation has no undefined', !JSON.stringify(evaluation).includes('undefined'), 'JSON check');
assert('Score bounded 0-100', evaluation.opportunity_score >= 0 && evaluation.opportunity_score <= 100, `score=${evaluation.opportunity_score}`);
assert('Confidence is not HIGH (missing local data)', evaluation.confidence_level !== 'HIGH', `conf=${evaluation.confidence_level}`);
assert('Evaluation mentions missing local data in gaps', evaluation.data_gaps.some((g) => /local|verified.*data|external/i.test(g)), `gaps: ${evaluation.data_gaps.slice(0, 3).join('; ')}`);
assert('Score capped low when no local data', evaluation.opportunity_score <= 30, `score=${evaluation.opportunity_score} (expected <=30 with no local data)`);
assert('Report shows correct origin/destination', evaluation.origin === 'India' && evaluation.destination === 'Afghanistan' && evaluation.city === 'Mazar-e-Sharif', `origin=${evaluation.origin}, dest=${evaluation.destination}, city=${evaluation.city}`);

// ---- STEP 8: Report origin/destination ===
console.log('\n=== STEP 8: Report Scope ===');
// Verify the report would show correct origin/destination/city
// (We check the intent fields that feed into the report)
assert('Intent origin preserved as India', intent.origin === 'India', `origin=${intent.origin}`);
assert('Intent destination preserved as Afghanistan', intent.destination === 'Afghanistan', `dest=${intent.destination}`);
assert('Intent city preserved as Mazar-e-Sharif', intent.city === 'Mazar-e-Sharif', `city=${intent.city}`);

// ---- SUMMARY ----
console.log('\n=== DEMO SUMMARY ===');
console.log(`Origin: ${intent.origin} | Destination: ${intent.destination} | City: ${intent.city}`);
console.log(`Price points: ${findings.price_points.length} | Supply: ${findings.supply} | Demand: ${findings.demand}`);
console.log(`FX: ESTIMATED (fallback) | Score: ${evaluation.opportunity_score} | Rec: ${evaluation.recommendation} | Conf: ${evaluation.confidence_level}`);
console.log(`Data gaps: ${evaluation.data_gaps.length}`);

if (process.exitCode) {
  console.log('\nDEMO FAILED — some assertions failed.');
} else {
  console.log('\nDEMO PASSED — all assertions passed.');
}
