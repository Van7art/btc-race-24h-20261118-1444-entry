# btc-race-24h-20261118-1444-entry

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Van7art/btc-race-24h-20261118-1444-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Van7art/btc-race-24h-20261118-1444-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Trailing-stop dip rider for CBBTC/USDC, long only. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC.

## Strategy

On the dev window the money is in one slow, multi-hour recovery after a deep washout, not in a quick bounce and not in chasing trends (every trend baseline lost money). So this bot buys the deep dip — close down at least 1.50% against 120 bars ago with RSI(14) below 35 — with full cash, then rides it: it exits only when the position pulls back 0.80% from its best mark since entry, or at +3.00% over cost, -1.50% under cost, or after 360 bars, whichever comes first. It never enters in the last 60 bars of the window. No lookahead, no randomness, no clock: deterministic. Local dev grade: **+16.54 USDC net PnL** (2 trades, max drawdown 0.65%).

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout (see the kit's `sdk/makefun-bars.ts`, vendored under `vendor/`). Grade it locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot <repository> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=4e96xqxt&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
