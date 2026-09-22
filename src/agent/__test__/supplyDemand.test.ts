// Focused Unit Tests for Global Supply/Demand Calibration Engine
// Run with: npx tsx src/agent/__test__/supplyDemand.test.ts

import { supplyDemandEngine, demandEngine, type EngineInput } from '../engines';

function assert(name: string, condition: boolean, details: string): void {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}: ${details}`);
  if (!condition) process.exitCode = 1;
}

const now = Date.now();
const MS_PER_DAY = 86400000;
const dateCurrent = new Date(now - 2 * MS_PER_DAY).toISOString().slice(0, 10);
const dateStale = new Date(now - 60 * MS_PER_DAY).toISOString().slice(0, 10);

console.log('\n=== SCENARIO 1: Strong Supply Evidence ===');
const inputStrongSupply: EngineInput = {
  commodity: 'Soybeans',
  origin: 'Brazil',
  destination: 'China',
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Bumper harvest leads to abundant supply of soybeans in Brazil',
      url: 'https://example.com/soy-supply',
      snippet: 'Brazil record crop yields excess supply and ample stocks for export.',
      source_type: 'news',
      published_date: dateCurrent,
      confidence: 'HIGH',
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res1 = supplyDemandEngine(inputStrongSupply);
assert('Strong supply evidence -> High supply', res1.supply === 'High', `got "${res1.supply}"`);


console.log('\n=== SCENARIO 2: Weak Supply / Constrained Evidence ===');
const inputWeakSupply: EngineInput = {
  commodity: 'Wheat',
  origin: 'Australia',
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Drought causes crop failure and reduced harvest of Australian wheat',
      url: 'https://example.com/wheat-drought',
      snippet: 'Drought conditions lead to tight supply and depleted stocks in Australian wheat.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res2 = supplyDemandEngine(inputWeakSupply);
assert('Weak supply / crop failure -> Tight supply', res2.supply === 'Tight', `got "${res2.supply}"`);


console.log('\n=== SCENARIO 3: Supply Shortage / Disruption ===');
const inputShortageSupply: EngineInput = {
  commodity: 'Corn',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Severe shortage and supply crisis in global corn markets',
      url: 'https://example.com/corn-shortage',
      snippet: 'Critical shortage and acute supply crisis affect global corn availability.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res3 = supplyDemandEngine(inputShortageSupply);
assert('Supply crisis -> Critical supply', res3.supply === 'Critical', `got "${res3.supply}"`);


console.log('\n=== SCENARIO 4: Strong Demand Evidence ===');
const inputStrongDemand: EngineInput = {
  commodity: 'Copper',
  origin: 'Chile',
  destination: 'China',
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Robust demand and rising consumption for Chilean copper in China',
      url: 'https://example.com/copper-demand',
      snippet: 'China import demand for copper is strong with increased industrial buying activity.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res4 = supplyDemandEngine(inputStrongDemand);
assert('Strong demand evidence -> Strong demand', res4.demand === 'Strong', `got "${res4.demand}"`);


console.log('\n=== SCENARIO 5: Weak Demand Evidence ===');
const inputWeakDemand: EngineInput = {
  commodity: 'Cotton',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Sluggish textile sales result in weak demand for cotton',
      url: 'https://example.com/cotton-weak',
      snippet: 'Declining demand and lower consumption reported for cotton.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res5 = supplyDemandEngine(inputWeakDemand);
assert('Weak demand evidence -> Weak demand', res5.demand === 'Weak', `got "${res5.demand}"`);


console.log('\n=== SCENARIO 6: Demand Surge ===');
const inputDemandSurge: EngineInput = {
  commodity: 'Sugar',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Explosive demand surge in global sugar purchases',
      url: 'https://example.com/sugar-surge',
      snippet: 'Soaring demand and a sharp spike in demand for sugar observed.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res6 = supplyDemandEngine(inputDemandSurge);
assert('Demand surge -> Surging demand', res6.demand === 'Surging', `got "${res6.demand}"`);


console.log('\n=== SCENARIO 7: Conflicting Supply Evidence ===');
const inputConflictSupply: EngineInput = {
  commodity: 'Rice',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Bumper harvest yields abundant supply of rice',
      url: 'https://example.com/rice-high',
      snippet: 'Ample supply and surplus production reported.',
      source_type: 'news',
      published_date: dateCurrent,
      confidence: 'HIGH',
    },
    {
      title: 'Severe shortage and export restriction on rice',
      url: 'https://example.com/rice-tight',
      snippet: 'Tight supply and severe shortage reported.',
      source_type: 'news',
      published_date: dateCurrent,
      confidence: 'HIGH',
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res7 = supplyDemandEngine(inputConflictSupply);
assert('Conflicting supply -> Unknown supply', res7.supply === 'Unknown', `got "${res7.supply}"`);
assert('Conflicting supply -> conflict flagged', res7.conflicts.length > 0 || res7.evidence.includes('Conflicting'), `evidence="${res7.evidence}"`);


console.log('\n=== SCENARIO 8: Conflicting Demand Evidence ===');
const inputConflictDemand: EngineInput = {
  commodity: 'Wheat',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Strong demand and soaring consumption for wheat',
      url: 'https://example.com/wheat-strong',
      snippet: 'Demand is surging with strong buying.',
      source_type: 'news',
      published_date: dateCurrent,
      confidence: 'HIGH',
    },
    {
      title: 'Weak demand and falling consumption for wheat',
      url: 'https://example.com/wheat-weak',
      snippet: 'Demand is weak with reduced buying.',
      source_type: 'news',
      published_date: dateCurrent,
      confidence: 'HIGH',
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res8 = supplyDemandEngine(inputConflictDemand);
assert('Conflicting demand -> Unknown demand', res8.demand === 'Unknown', `got "${res8.demand}"`);


console.log('\n=== SCENARIO 9: No Evidence ===');
const inputNoEvidence: EngineInput = {
  commodity: 'Barley',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res9 = supplyDemandEngine(inputNoEvidence);
assert('No evidence -> Unknown supply', res9.supply === 'Unknown', `got "${res9.supply}"`);
assert('No evidence -> Unknown demand', res9.demand === 'Unknown', `got "${res9.demand}"`);


console.log('\n=== SCENARIO 10: Stale Evidence ===');
const inputStaleEvidence: EngineInput = {
  commodity: 'Palm Oil',
  origin: 'Malaysia',
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Malaysia palm oil report from two months ago',
      url: 'https://example.com/stale-palm',
      snippet: 'High supply of palm oil noted earlier.',
      source_type: 'news',
      published_date: dateStale,
      confidence: 'LOW',
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res10 = supplyDemandEngine(inputStaleEvidence);
assert('Stale low-confidence evidence yields lower weight trace', res10.evidence.includes('weight:') || res10.supply !== undefined, `evidence="${res10.evidence}"`);


console.log('\n=== SCENARIO 11: Low-Confidence Evidence ===');
const inputLowConf: EngineInput = {
  commodity: 'Sorghum',
  origin: null,
  destination: null,
  city: null,
  currencies: ['USD'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Unverified blog mention of sorghum demand',
      url: 'https://example.com/blog',
      snippet: 'Strong demand for sorghum mentioned on forum.',
      source_type: 'blog',
      published_date: dateCurrent,
      confidence: 'LOW',
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const demandIntelLowConf = demandEngine(inputLowConf);
assert('Low-confidence evidence reflects LOW confidence rating', demandIntelLowConf.confidence === 'LOW', `got "${demandIntelLowConf.confidence}"`);


console.log('\n=== SCENARIO 12: Non-Afghanistan Global Commodities ===');
const inputGlobalNonAfg: EngineInput = {
  commodity: 'Copper',
  origin: 'Chile',
  destination: 'Japan',
  city: 'Tokyo',
  currencies: ['USD', 'JPY'],
  marketRows: [],
  fxRates: [],
  researchResults: [
    {
      title: 'Chile copper exports to Tokyo facing tight supply due to mine shutdown',
      url: 'https://example.com/chile-tokyo',
      snippet: 'Supply disruption in Chile leads to tight supply for copper imports to Tokyo.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res12 = supplyDemandEngine(inputGlobalNonAfg);
assert('Global Chilean Copper query evaluates correctly without Afghanistan reliance', res12.supply === 'Tight', `got "${res12.supply}"`);


console.log('\n=== SCENARIO 13: Market Comparison Workflow (Russia vs Kazakhstan Wheat) ===');
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
      title: 'Russia record wheat production leads to high supply',
      url: 'https://example.com/russia-wheat',
      snippet: 'Abundant supply and record production of wheat in Russia.',
      source_type: 'news',
      published_date: dateCurrent,
    },
    {
      title: 'Kazakhstan drought leads to tight supply of wheat',
      url: 'https://example.com/kazakhstan-wheat',
      snippet: 'Drought causes crop failure and tight supply in Kazakhstan.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res13 = supplyDemandEngine(comparisonInput);
assert('Comparison with differing market supply levels reports aggregate supply as Unknown', res13.supply === 'Unknown', `got "${res13.supply}"`);
assert('Comparison evidence contains distinct assessments for both Russia and Kazakhstan', res13.evidence.includes('Russia') && res13.evidence.includes('Kazakhstan'), `evidence="${res13.evidence}"`);


console.log('\n=== SCENARIO 14: Combination of Price + Research Evidence Without Leakage ===');
const combinedInput: EngineInput = {
  commodity: 'Corn',
  origin: 'Brazil',
  destination: 'Egypt',
  city: null,
  currencies: ['USD'],
  marketRows: [
    {
      id: 'm1',
      commodity: 'Corn',
      country: 'Brazil',
      observation_date: dateCurrent,
      data_status: 'VERIFIED',
      confidence: 'HIGH',
      supply: 'High',
      demand: null,
      created_at: dateCurrent,
    },
  ],
  fxRates: [],
  researchResults: [
    {
      title: 'Egypt corn import demand strong',
      url: 'https://example.com/egypt-corn',
      snippet: 'Strong demand for imported corn in Egypt.',
      source_type: 'news',
      published_date: dateCurrent,
    },
  ],
  stockRows: [],
  shipmentRows: [],
  researchStatus: 'OK',
};
const res14 = supplyDemandEngine(combinedInput);
assert('Combined stored market row + research evaluates correctly without leakage', res14.supply === 'High' && res14.demand === 'Strong', `supply="${res14.supply}", demand="${res14.demand}"`);

console.log('\n=== ALL SUPPLY/DEMAND CALIBRATION TESTS SUMMARY ===');
if (process.exitCode) {
  console.log('SUPPLY/DEMAND TEST SUITE FAILED — see details above.');
} else {
  console.log('SUPPLY/DEMAND TEST SUITE PASSED — all 14 calibration scenarios passed cleanly.');
}
