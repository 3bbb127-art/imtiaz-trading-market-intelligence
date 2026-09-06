# Imtiaz Trading Market Intelligence Agent — Final Handoff

This ZIP is the modified project prepared for the final verification pass by another coding agent.

## Business target
Imtiaz Trading Co. Ltd — Market Intelligence Officer workflow, focused on Afghanistan and especially Mazar-e-Sharif.

## What was completed in this handoff
- The main Agent workflow now collects stored Stock records and Shipment/Wagon records alongside Market Data and FX.
- The Agent's research query now explicitly covers prices, supply, demand, arrivals, wagons, stock/inventory, customs/tariffs, import regulation, borders/logistics, competitors, and market sentiment.
- Operational stock and shipment intelligence is included in structured findings and management reports.
- Shipment delay / ETA context is included in logistics risk reporting.
- New Commodity Evaluation now receives stock and shipment context and includes operational evidence in supply/logistics assessment and confidence scoring.
- MarketData field-visit collector typing was aligned with the engine input shape.
- Final test acceptance criteria are included in `.bolt/prompt`.

## Final verification requested from the receiving coding agent
Run:

    npm run typecheck
    npm run lint
    npm run build

Then manually verify one realistic Mazar-e-Sharif commodity scenario using all three stored data layers:
1. Market Data record
2. Stock Record
3. Shipment/Wagon Record

Example test flow:
- Add a Wheat market observation in Mazar-e-Sharif with price, supply, demand, competitor, logistics and source data.
- Add a Wheat stock record with available stock, in-transit stock and expected incoming quantity.
- Add a Wheat shipment/wagon with origin, quantity, expected arrival and status `In Transit` or `Delayed`.
- Ask the Agent for a Wheat market intelligence report for Mazar-e-Sharif.
- Confirm the final report shows price evidence, supply/demand, stock position, shipment/wagon status, ETA, logistics risk, sources, data gaps, forecast and recommendation.
- Run New Commodity Evaluation and confirm the operational data affects the supply/logistics assessment and confidence score.

## Important integrity rule
Do not fabricate missing market, stock, shipment, customs, FX, competitor or policy facts. Unknown values must remain unknown and data gaps must be shown.

## Known environment limitation during preparation
The provided ZIP did not contain a reliable complete `node_modules` install in the build environment. Attempts to reinstall dependencies timed out, so the receiving agent must perform the definitive typecheck/lint/build inside Bolt/Replit/local environment with dependencies installed.
