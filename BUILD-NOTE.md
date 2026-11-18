# Build note — btc-race-24h-20261118-1444

Built 2026-11-18 ~23:20–23:50 WITA (competition opened 2026-11-18T14:44:00Z = 22:44 WITA, entries close 2026-11-18T20:44:00Z = 04:44 WITA 19 Nov; result due 2026-12-11).

## Kit
- Kit dir: `~/workspace/makefun/btc-race-3-kit/btc-race-24h-20261118-1444-kit/` (downloaded from https://make.fun/c/btc-race-24h-20261118-1444/kit, bundle sha256 157048c6…)
- RULES.txt + competition.yaml read in full. Free entry ($0), harness bars-replay/v1, NOT a Claude Code/Codex-only harness.
- Dev window: 24h of 1-minute CBBTC bars, 2026-11-17T14:45Z → 2026-11-18T14:44Z, 1,440 bars, 0 gaps. Overall -2.80%, range 3.35%, max drawdown 3.24%. A falling window: buy-and-hold loses ~2.8% + costs.

## Method
- Built an offline simulator replicating the harness fill model exactly (fees 4 bps, slippage 2 bps, constant-product impact 1 + a/D against the bar's open depth, fills at next bar's open, max-slippage check, final flatten) and validated it against the kit: it reproduces the previous round's entry grade on THIS dev window to the micro-USDC (-8.372389 USDC, fees 1.596369, drawdown 1.49%).
- Grid-searched 7 strategy families offline (~10,000 parameter sets): dip-buy, fast scalper, momentum/EMA-cross, Bollinger/RSI, RSI turn-up, SMA reversion, bounce-off-low, washout, layered scale-in dip, and dip-with-trailing-stop. Momentum (0/648 positive) and Bollinger/RSI (0/648 positive) families were tested and rejected — they lose money on this falling window. An event study showed the edge is in deep multi-hour washouts that recover over ~360 bars, with 15-minute bounces after sharp 5–15 min dips as a secondary pattern.
- The previous round's winning parameters (dip 0.90%/60 bars, RSI<35, TP +1.00%) LOSE on this window (-8.37 USDC) — the dip keeps falling — so all three variants were written fresh (new code, new parameters, new logic), not copied from `~/workspace/makefun/btc-race-2-entry/`.

## The three variants (all under `~/workspace/makefun/btc-race-3-variants/`)
Each has main.ts, vendor/makefun-bars.ts (byte-identical copy of the kit SDK, sha256 9677370b0ab7e759c486a929afc95a11fb0fb32c7ec37053d3ebabd426aec5c8), LICENSE (MIT), README.md.

### 1. deep-dip — fixed take-profit dip-buy (retuned mean reversion)
- Entry: close down ≥1.50% vs 120 bars ago AND RSI(14) < 30. Exit: TP +1.80% / SL -1.50% / 360-bar time stop. No entry in the last 60 bars.
- Local dev grade (kit grade-local, process driver, run twice): **+16.385534 USDC**, 2 trades, win rate 100%, fees 0.806717, max drawdown 0.65%, Sharpe 0.032, 0 rejected. Net PnL at 2x fees: +15.57 USDC. Guardrails met.
- Plateau: dip 1.20–1.65% × TP 1.30–3.00% all grade +13 to +16 USDC.

### 2. turn-up — bounce-confirmation entry
- Entry: close down ≥0.90% vs 120 bars ago AND RSI(14) crosses back up through 30 (buys the turn, not the falling knife). Exit: TP +2.00% / SL -1.50% / 360-bar time stop.
- Local dev grade (run twice): **+12.478289 USDC**, 2 trades, win rate 100%, fees 0.805154, max drawdown 0.65%, Sharpe 0.024, 1 rejected order (a sell refused once on slippage, re-sent and filled next bar). Net PnL at 2x fees: +11.67 USDC. Guardrails met.
- Plateau: lookback 60–120, dip 0.90–1.20%, turn level 30–35, TP 1.30–3.00% all grade +3 to +12 USDC.

### 3. trail-rider — deep dip + trailing-stop exit ★ WINNER
- Entry: close down ≥1.50% vs 120 bars ago AND RSI(14) < 35. Exit: trailing stop 0.80% below peak value since entry / TP +3.00% (spike cap) / SL -1.50% / 360-bar time stop. No entry in the last 60 bars.
- Local dev grade (run twice): **+16.540827 USDC**, 2 trades, win rate 100%, fees 0.806780, max drawdown 0.65%, Sharpe 0.031, 0 rejected. Net PnL at 2x fees: +15.73 USDC. Guardrails met.
- Plateau: dip 1.35–1.65% × trailing stop 0.70–1.20% all grade exactly +16.54 USDC — flat, not a knife-edge.

## Winner: trail-rider
- Highest dev net PnL (+16.54 vs +16.39 vs +12.48), and the trailing stop is the most adaptive exit for the unseen race window: it rides a slow recovery for as long as it keeps making new highs and steps out on the first 0.80% pullback, instead of cutting the recovery at a fixed level.
- Copied into the final entry dir `~/workspace/makefun/btc-race-3-entry/` (main.ts, vendor/, LICENSE, README.md with badges for slug btc-race-24h-20261118-1444 and repo Van7art/btc-race-24h-20261118-1444-entry).

## Determinism evidence (grade-local, two runs per variant)
- deep-dip: action_log_sha256 identical across both runs: `437554f915cbb430f74bcd39434c99bce2ec7c2f28e799d10eb1644a55292a5f`; result_sha256 `b8faceed2ac7236016328bdbc37b6300461dd0a50b45bf0318fce3dc1d6d12c0`; L1 regrade reproduced byte for byte both times.
- turn-up: action_log_sha256 identical: `e88bb1f4ed3b3275ea2c1277d3283543286fa358464b38287490c988e85899d3`; result_sha256 `751c47786f6c4343cdf4cf7aefe42b217f53a58dc19a753c6e2d7fc5ae5b24ea`; L1 regrade reproduced byte for byte both times.
- trail-rider: action_log_sha256 identical: `1481baa99f30dc2bf7e3227acb5ba9e9bb09af8a35e0a4571d072bf3d7d5dfb0`; result_sha256 `50eb376d46fb203354b0a2bf8082ee80d2b4570ed2d1cca7d2fded898401d129`; L1 regrade reproduced byte for byte both times.
- Only mismatch vs server: local Node v24.22.1 vs server harness Node v26.13.1 (code uses erasable TypeScript only).

## What the parent still needs to do (NOT done by this build)
1. Create a NEW public GitHub repo AFTER the competition opened (2026-11-18T14:44:00Z) — `Van7art/btc-race-24h-20261118-1444-entry` — and install the GitHub App.
2. Push `~/workspace/makefun/btc-race-3-entry/` (main.ts, vendor/, LICENSE, README.md), bundle transcripts, run `check`, then submit before 04:44 WITA 19 Nov. Do NOT submit a bundle from a session that started before the competition opened.
3. The entry's dev grade passes the gate (+16.54 > $0), so it races if submitted before the deadline.

## Not done (per task)
- No push to GitHub, no repo created, no transcript bundle, no submission.
