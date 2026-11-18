// SPDX-License-Identifier: MIT
// Trailing-stop dip rider for CBBTC/USDC, bars-replay/v1, long only.
//
// On the dev window (24h of 1-minute cbBTC bars, -2.80% overall with a
// 3.35% range) the money is in one slow, multi-hour recovery after a deep
// washout — not in a quick bounce, and not in chasing trends (every trend
// baseline lost money there). A fixed take-profit cuts that recovery short
// at an arbitrary level, and a wide stop gives the gains back. So this bot
// buys the deep dip and then lets a trailing stop do the timing: it rides
// the recovery for as long as it keeps making new highs, and steps out
// only when the price pulls back 0.80% from its best mark since entry.
//
// Entry (full cash, one position at a time):
//   - close down at least 1.50% against its close 120 bars ago, and
//   - RSI(14, Wilder) below 35 (oversold).
// Exit (whole position):
//   - trailing stop: position value 0.80% below its peak since entry, or
//   - take profit at +3.00% over cost (a cap for a runaway spike), or
//   - stop loss at -1.50% under its cost, or
//   - time stop after 360 bars held.
// It never enters in the last 60 bars of the 1,440-bar window: a position
// opened there cannot reach its target before the final flatten, so it
// would only pay fees. No lookahead (only closes already sent), no clock,
// no randomness, no environment reads: the same bars give the same orders,
// run after run.
//
// Local dev grade (kit grade-local, process driver): +16.54 USDC net PnL
// on the published dev window, 2 trades, max drawdown 0.65%. The
// parameters sit on a plateau: dip 1.35-1.65% and trailing stop 0.70-1.20%
// all grade +16.54 USDC, so the result is not a knife-edge fit.
//
// TypeScript, not Python: the kit's local grader on this machine runs Node
// only (python3.13 runs only inside Docker, which is unavailable here), so
// the entry is written in TypeScript to be verifiable with the kit's own
// grade-local command before submission.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK_BARS = 120;
const DIP_BPS = 150; // 1.50% down over the lookback
const RSI_PERIOD = 14;
const RSI_ENTRY_BELOW = 35;
const TRAIL_BPS = 80; // 0.80% pullback from the peak value since entry
const TAKE_PROFIT_BPS = 300; // +3.00% over cost (spike cap)
const STOP_LOSS_BPS = 150; // -1.50% under cost
const MAX_HOLD_BARS = 360;
const NO_ENTRY_TAIL_BARS = 60; // last bars of the 1,440-bar window
const WINDOW_BARS = 1440;
const MAX_SLIPPAGE_BPS = 100;

/** Wilder RSI(14) over the closes, as running averages. */
const rsiPeriod = RSI_PERIOD;
let gainAvg: number | null = null;
let lossAvg: number | null = null;
const seed: number[] = [];
let lastClose: number | null = null;
/** Last LOOKBACK_BARS + 1 closes, oldest first. */
const history: number[] = [];
/** Seq of the batch that decided the current entry (for the time stop). */
let entrySeq = -1;
/** Best position value (quote units) seen since the entry. */
let peakValue = 0n;

function rsiNow(): number | null {
  if (gainAvg === null || lossAvg === null) return null;
  const moved = gainAvg + lossAvg;
  return moved === 0 ? 50 : (100 * gainAvg) / moved;
}

function note(bar: Bar): void {
  const c = Number(bar.c);
  history.push(c);
  if (history.length > LOOKBACK_BARS + 1) history.shift();
  if (lastClose !== null) {
    const change = c - lastClose;
    if (gainAvg === null || lossAvg === null) {
      seed.push(change);
      if (seed.length === rsiPeriod) {
        gainAvg = seed.reduce((a, x) => a + (x > 0 ? x : 0), 0) / rsiPeriod;
        lossAvg = seed.reduce((a, x) => a + (x < 0 ? -x : 0), 0) / rsiPeriod;
        seed.length = 0;
      }
    } else {
      gainAvg = (gainAvg * (rsiPeriod - 1) + (change > 0 ? change : 0)) / rsiPeriod;
      lossAvg = (lossAvg * (rsiPeriod - 1) + (change < 0 ? -change : 0)) / rsiPeriod;
    }
  }
  lastClose = c;
}

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) if (bar.symbol === SYMBOL) note(bar);
    if (state.warmingUp) return [];
    if (!batch.bars.some((b) => b.symbol === SYMBOL)) return [];
    const { caps, fees } = state.hello;
    const held = state.positions.get(SYMBOL);

    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      if (value > peakValue) peakValue = value;
      const cost = held.cost;
      const trailing = peakValue > 0n && value * 10_000n <= peakValue * BigInt(10_000 - TRAIL_BPS);
      const takeProfit = value * 10_000n >= cost * BigInt(10_000 + TAKE_PROFIT_BPS);
      const stopLoss = value * 10_000n <= cost * BigInt(10_000 - STOP_LOSS_BPS);
      const timeStop = entrySeq >= 0 && batch.seq - entrySeq >= MAX_HOLD_BARS;
      if (trailing || takeProfit || stopLoss || timeStop) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        entrySeq = -1;
        peakValue = 0n;
        return [sell];
      }
      return [];
    }

    peakValue = 0n;
    if (batch.seq >= WINDOW_BARS - NO_ENTRY_TAIL_BARS) return [];
    if (history.length <= LOOKBACK_BARS) return [];
    const now = history[history.length - 1]!;
    const then = history[0]!;
    const dip = then === 0 ? 0 : ((then - now) / then) * 10_000;
    const rsi = rsiNow();
    if (dip < DIP_BPS || rsi === null || rsi >= RSI_ENTRY_BELOW) return [];
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    entrySeq = batch.seq;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
