# Pons (PONS) — Research Report

**Token:** PONS, `0x39dBED3a2bd333467115dE45665cC57F813C4571`
**Chain:** Robinhood mainnet, chainId 4663
**Date:** 2026-10-29. Figures are dated where they move.

---

## Summary

Pons is a token launchpad on Robinhood Chain. Projects create a token in two
steps and bootstrap liquidity along an automated bonding curve; buyers trade
along that curve, price rises with demand according to its formula, and once
trading reaches set thresholds the token graduates to ordinary decentralised
exchanges and leaves the curve.

The PONS token is one billion units at 18 decimals, read from the contract. At
2026-10-28 it traded at $0.288 for a market capitalisation of $193.98M, ranked
181, on $61.2M of daily volume, with 13 centralised exchange listings and more
than fifteen decentralised venues on its own chain.

The category it competes in is dominated by a single incumbent. Raydium, on
Solana, carries a $469M market capitalisation and $30.3M of daily volume; every
other launchpad token is two orders of magnitude smaller.

Three things about Pons are not publicly documented, and each is material.
How much capital has been raised or how many tokens launched on the platform —
the measure of whether the product is used at all. Where 99.877% of the token
supply sits. And whether holding PONS is required to use Pons.

---

## The market

Launchpad platforms let a project raise capital and distribute a new token to a
curated or broad audience, supplying the distribution infrastructure, the
initial liquidity and access to a pool of buyers. The category is narrower than
it first appears: it excludes general decentralised exchanges, which provide
trading but not launches; centralised exchanges, which list tokens that already
exist; and grant or venture programmes, which supply funding without token
distribution.

Measured by the market capitalisation of the platforms' own tokens, the category
is worth about $475M (CoinGecko, 2026-10-28):

| Platform | Market cap | 24h volume | Rank |
|---|---|---|---|
| Raydium | $469,000,000 | $30,300,000 | 117 |
| Polkastarter | $5,730,000 | $80,960 | 1,632 |
| Impossible Finance | $26,101 | $4.01 | 9,266 |
| Launchpad.meme | $16,287 | $72.79 | 10,383 |

That measure has a known weakness: it prices the platforms' tokens rather than
counting what the platforms move. The figures that would do the latter — capital
raised year to date, tokens launched, average raise size, share by platform —
are not obtainable. Launchpads do not uniformly publish transaction logs, raises
are frequently private, and the services that track the category sell the data
by subscription. The category's size is therefore known only by proxy.

**Raydium** is the incumbent: Solana-native, first to market there, holding the
deepest liquidity, the established project relationships and its own launch arm,
AcceleRaytor. **Polkastarter** is multi-chain, historically Polkadot-focused and
expanding to EVM chains, running a portfolio-based launch model since 2021.
Below those two the field fragments — several protocols claim the "IDO" label
with whitelist and tiered-access mechanics, and none has emerged as the
alternative.

Projects choose a launchpad for five reasons. A new token needs initial
liquidity or it suffers concentration and slippage. Launchpads aggregate capital
and curate access, which cuts discovery cost for buyers. Launching through a
known venue signals legitimacy where an anonymous liquidity pool does not.
Platforms hand their own token holders launch allocations, which creates demand
for the platform token itself. And the infrastructure usually arrives with
community tooling attached.

Entry is hard for reasons that compound: liquidity network effects, project
relationships incumbents rarely lose, the multi-chain breadth mature platforms
offer against a newcomer's single chain, and securities treatment of token
launches that remains unsettled. Three things work the other way. New chains
arrive without launch infrastructure, so first-mover advantage is still
available on them. The incumbent's scale may itself create appetite for smaller,
specialised venues on different terms. And launchpad mechanics — whitelisting,
tiered allocation, vesting — are standardised enough that building one is no
longer novel engineering.

Fees in the category have historically run 5–20% of a raise. No current fee
schedule was obtainable for any platform, including Pons.

---

## The business

**What a user does.** Create a token, deposit capital to fund its bonding curve,
and let buyers trade along it until the token graduates to a DEX. The project
describes itself in those terms on its own site, ponsfamily.com/launchpad.

**Who uses it.** Project teams launching on Robinhood Chain who want liquidity
without meeting a centralised exchange's listing requirements. Traders and
speculators buying along curves during the launch phase. And automated
participants: public sniper and copy-trading bot implementations targeting Pons
launches existed on GitHub by 2026-10-09, which is itself evidence of a launch
flow worth automating. Before launchpads, a project's options were a
conventional liquidity pool, which demands large upfront capital, or a token
sale, which demands registration and regulatory navigation.

**How it makes money.** Pons takes fees on token creation and on trades along
active curves. The percentages are not published — not on the site, not in the
repository, nowhere reachable. There is no public accounting of platform
revenue, no fee schedule, and no disclosed route by which fees reach token
holders. The revenue model is therefore known in kind but not in amount.

**What it costs to run.** Execution costs fall on users as gas. No central
servers, CDN or hosted services are evident; the protocol runs on chain, so
costs do not obviously scale with usage the way a hosted service's would. Team
compensation, infrastructure spend and burn rate are undisclosed, so the cost
base is invisible from outside.

**Traction**, measured 2026-10-28 15:08 UTC:

| Metric | Value |
|---|---|
| Market capitalisation | $193,983,888 — rank 181 |
| 24-hour volume | $61,229,661 |
| Price | $0.288 |
| Circulating supply | 671,926,368.87 PONS — 67.2% of one billion |

Thirteen centralised exchanges carry it: Coinbase, Kraken and Crypto.com;
OKX, Gate, Bybit, Upbit and Bithumb; MEXC, Toobit, BloFin, KCEX and BTSE. On
Robinhood Chain there are fifteen or more decentralised venues with PONS pairs,
across Uniswap V4, V3 and V2, Ramses, Aero, Ekubo, GIGA, Up, Topaz, RobinSwap,
Rialto, Arcus and Alandale.

Those figures measure the token's market presence. They do not measure the
platform's usage, and no public figure does.

**Who is behind it.** A GitHub account, `PonsFamily`, holding the repository
`PonsFamily/PonsFamily` — "Token launchpad: create, launch and graduate tokens
on a transparent bonding curve" — and the website ponsfamily.com. Nothing
further is public: no individual names, no company or legal structure, no
jurisdiction, no founding date, no prior work by the people involved, no funding
history, no investors. No audit or independent security review exists.

---

## The token

**Supply.** One billion PONS, or 1,000,000,000,000,000,000,000,000,000 raw
units at 18 decimals, from the contract's `totalSupply()` and `decimals()`.
Whether that figure is a ceiling is a separate question and an open one: the
contract exposes no cap, and no mint authority is callable on it, so supply
cannot be shown to be fixed — only measured at one billion today.

**Concentration.** One address, `0xb995b91882f5990e5ab3cc4700b66b20a66c4c79`,
holds 75,149,907 PONS by `balanceOf` — **7.515% of supply**. This holding is
large enough that the distribution cannot be described as dispersed.

**Allocation.** This is the weakest-documented part of the token and the most
consequential. Holdings covering 0.123% of supply have been enumerated; the
remaining **99.877% is unaccounted for**. Project documentation describes a
genesis split of 10% to a MerkleDistributor, 88% to a single-sided ETH liquidity
pool and 2% to the requester. That is a statement in a document, not an
observation: establishing it would mean identifying those contract addresses and
reading each balance, and that has not been done. Set against it, circulating
supply is reported at 67.2% of one billion, which implies roughly 328 million
PONS held somewhere outside circulation — consistent with a large pooled or
locked allocation, but not evidence of one.

**Utility, value accrual and governance.** The contract exposes no function the
token is required for, no mechanism by which platform usage reaches a holder —
no fee claim, buyback, burn or staking reward — and no governance capability.
The project's materials suggest the token carries governance rights and possibly
a share of fees, but no mechanism for either is documented and none is visible
on chain. This matters more than it would for most tokens, because in this
category fee participation, voting on upcoming launches and allocation
multipliers are the standard reasons to hold a platform token. For PONS those
reasons are asserted, not demonstrated.

**Vesting and unlocks.** No vesting schedule or time-locked distribution is
enforced by the contract. If a schedule exists it lives elsewhere, and the
roughly 328 million tokens outside circulation have no published release
timetable.

---

## What this adds up to

**The valuation rests on figures nobody can obtain.** A launchpad is judged by
what it raises and launches; neither figure exists publicly for Pons or for its
category. Platform revenue is undisclosed. Almost the entire token supply is
unplaced. The $193.98M valuation is not contradicted by evidence — it is
unsupported by it, which is a different and more awkward position.

**Distribution has run ahead of demonstrated use.** PONS turns over $61.2M a
day across 13 centralised exchanges, roughly twice the daily volume of the
category leader's token, while nothing public shows its launchpad has been used
once. For a three-month-old project on a new chain, that ordering is unusual:
exchange reach of the kind incumbency normally buys, attached to a product whose
usage cannot be evidenced.

**The reason to own the token is the part that is missing.** The category's
answer to "why hold a launchpad token" is a claim on fees and a say in launches.
Pons asserts both in its materials and implements neither anywhere a reader can
check. Until the fee route and the governance mechanism are documented, PONS is
priced as a claim on a business whose economics are undisclosed.

**What would change the picture.** Three disclosures, in order of value:
the platform's cumulative raises and launch count; the addresses holding the
non-circulating 328 million tokens, with any release schedule; and the fee
schedule with the route by which fees reach holders. Each is a thing the project
could publish tomorrow, and each is currently absent.

---

## Sources and method

This report consolidates three separately commissioned research reports, each
published in full:

| Scope | URL |
|---|---|
| The external market Pons is entering | https://gist.github.com/pridikanon/1c774c931b78777303b093fb9a85c04e |
| The product and its business model | https://gist.github.com/pridikanon/8c3e36fefeddbc0b7c30e9857e89c1ad |
| Supply, allocation, unlocks, utility, value accrual | https://gist.github.com/pridikanon/251a2772fc6eba16688c24d7f19835d1 |

Underlying data comes from the CoinGecko API, the DexScreener API, direct
contract reads on Robinhood mainnet via `cast call`, the project's own website
and its public GitHub repository, each as recorded and dated in the reports
above. Every figure here is drawn from them unchanged. Where a thing is stated
as unverified or undocumented, that reflects research that looked for it and did
not find it, rather than research that did not look.
