# Synthesis Report: Pons (PONS)

**Synthesis Date:** 2026-10-20  
**Token:** Pons (PONS)  
**Contract:** 0x39dBED3a2bd333467115dE45665cC57F813C4571  
**Chain:** Robinhood mainnet (chainId 4663)  
**Decimals:** 18  

**Reports Synthesized:**
- Market Report (pridikanon, market research)
- Business Report (pridikanon, organization and claims)
- Tokenomics Report (pridikanon, token economics)

---

## Core Token Metrics

**Total Supply:** All three reports agree on **1,000,000,000 PONS (1 billion)**.
- Market report: verified from contract read at block 93257571
- Business report: verified on-chain at block 93356058
- Tokenomics report: verified via contract call, raw units 1e27, decimals 18 applied

**Genesis Mint:** Tokenomics report is sole source. Entire supply minted in single transaction at block 8,963,150, to wallet 0x0c37a24f5d23a486fa692d1500881d698b1f77a4.

**Mint Hash Discrepancy:** The Tokenomics report cites two different hashes for the same mint event at block 8,963,150:
- Hash 1: 0xd18718d02fe1da449333e477bc588a41e59b1fd169a2b945a14fb17339d684a3
- Hash 2: 0x1f54f25fec2d963dcb338ecb8b46a6eb123198a5c7a746d34cb2dbe78d074af8

Chain verification on Robinhood mainnet (chainId 4663) confirms Hash 1 is the block hash for block 8,963,150. Hash 2 is the actual transaction hash: it contains the Transfer event from address 0x0000000000000000000000000000000000000000 to 0x0c37a24f5d23a486fa692d1500881d698b1f77a4 for the full supply amount. The correct genesis transaction hash is 0x1f54f25fec2d963dcb338ecb8b46a6eb123198a5c7a746d34cb2dbe78d074af8.

**Supply Authority:** Neither mint nor burn functions are callable on this contract.
- Tokenomics report explicitly tested both and found both revert with no data
- Business report notes contract does not expose owner(), minter(), or getRoleMember()

**Burns Disagreement:** Tokenomics report claims no emission or reduction detected in transfer log from block 0 to 9,999,999. Business report states: "at least one transfer to burn address 0x000...dead confirmed."

Chain verification on Robinhood mainnet (chainId 4663, read-only query): eth_getLogs for Transfer events to address 0x000000000000000000000000000000000000dead in blocks 0x0 to 0x989680 (blocks 0 to 9,999,999) returns zero results. Same query for transfers to zero address 0x0000000000000000000000000000000000000000 also returns zero results. The Tokenomics report is supported by chain data. The Business report's claim of a confirmed transfer to burn address is not confirmed on chain within the examined window.

---

## Market Activity

**Price (DexScreener-reported, from Market report):**
- Range: $0.2617–$0.2729 USD
- Most common: $0.2687–$0.2703 USD
- No independent verification of price performed; all figures from DexScreener API

**Liquidity & DEX Listings Disagreement:** 

Business report: "No public exchange listings found and trading appears limited to Robinhood Chain."

Market report lists the following pools with reserves on Robinhood mainnet:
  - PONS/WETH on Uniswap: $2.74M liquidity
  - PONS/USDG on Uniswap: $1.09M liquidity
  - PONS/WETH on Uniswap (second pair): $1.59M liquidity
  - PONS/USDG on Ramses: $860k liquidity

Total USD liquidity across these pools: ~$10–$12M. Bid-ask spread on major pairs: <0.4%.

These claims directly conflict: Business report found no public listings; Market report documents four trading pairs across two DEX venues.

**24-Hour Volume (DexScreener-reported, from Market report):**
- Total: $5.6M–$11M+ USD across all pairs
- Highest single pair: PONS/USDG on Ramses at $5.7M
- Transaction counts: PONS/USDG on Ramses shows 7,978 buys and 7,897 sells in 24h

**Market Capitalization (DexScreener-reported, from Market report):**
- Fully diluted valuation: ~$180M–$183M USD

---

## Transfer Activity: Disagreement Flagged

Two reports provide transfer counts for the same metric over the same time window (last 100,000 blocks):

- **Business report:** 5,965 distinct transfers logged in last 100,000 blocks
- **Tokenomics report:** 6,062 transfer events in last 100,000 blocks

The difference is 97 transfers (1.6% variance). Both reports cite the same analysis window and date their work 2026-10-20. The discrepancy may reflect:
1. Different timing of report execution within the same day (one captured more recent blocks)
2. Different counting methodology ("distinct transfers" vs. "transfer events" may be defined differently)
3. A genuine count variance

Neither report provides sufficient detail to determine which is correct or why they differ. Both agree that active transfer activity exists and is ongoing; they disagree only on the count. A reader wishing certainty should re-query the transfer log independently.

**Most Recent On-Chain Activity:** Business report places most recent transfer at block 93,256,081 (verified 2026-10-20).

---

## Holder Concentration

Tokenomics report alone provides holder concentration data. No verification of this data by other reports.

**Top 9 holders (by balance):**

| Rank | Address | Balance (PONS) | % of Total Supply |
|------|---------|-----------------|-------------------|
| 1 | 0xa64723bfdc2805c4ad09c509983cfd85362298ba | 32,142,752.60 | 3.21% |
| 2 | 0x0d0707963952f2fba59dd06f2b425ace40b492fe | 13,564,854.38 | 1.36% |
| 3 | 0x8366a39cc670b4001a1121b8f6a443a643e40951 | 10,636,233.11 | 1.06% |
| 4 | 0x10cc6bd38112cac182db90b6a71d8bb5939526ba | 5,314,887.32 | 0.53% |
| 5 | 0xf2a0be59ab76b96f957bd5e5b967f2b75e8db269 | 2,202,226.17 | 0.22% |
| 6 | 0xc33acc93942105c57602e59e8e448c20ba718a85 | 730,577.30 | 0.07% |
| 7 | 0x51c72848c68a965f66fa7a88855f9f7784502a7f | 665,793.32 | 0.07% |
| 8 | 0x2f393b60ef0cfaf669af63284e5592dc3a657b73 | 490,764.49 | 0.05% |
| 9 | 0x59ffd878fdcedb50a382a78346dcc29f3fb88b7e | 14,366.23 | 0.001% |

**Summary (Tokenomics report):**
- Top 1 holder: 3.21% of supply
- Top 3 holders: 5.65% of supply
- Top 9 holders: 6.58% of supply
- Unique recipients across last 100,000 blocks: 597 addresses

---

## Organization and Team

Business report alone addresses organizational questions. No verification of these claims by other reports.

**Project Identity:**
- Claimed homepage: ponsfamily.com (could not be accessed for verification; connection failed)
- Claimed Twitter: @ponsdotfamily (could not be verified without Twitter API credentials)

**CoinGecko Ranking Disagreement:**
- Business report: #195
- Market report: #196

Both figures refer to the same metric (CoinGecko rank) from the same API service but show a one-position discrepancy. The reports may have been executed at slightly different times when the ranking changed, or the figure may reflect different query points in the CoinGecko database.

**Confusion with other "Pons" entity:**
A separate organization operates pons.io, described as "The platform for legal work." This site states: "PONS runs your operations and does the heavy document work on top: it reads, checks against your standards, drafts, and answers, with the source attached to every answer." This is a legal AI document platform, not a token protocol. It has a LinkedIn company page. The Business report found no documentation of relationship between PONS token project and pons.io, if any exists.

**Team:**
No team members, founders, or funding sources disclosed in accessible public records. No named individuals found. No founding wallet with documented history identified.

**Audits, Partnerships, GitHub:**
- Audits: Not claimed and not found. Searched major audit firms.
- Partnerships: Not claimed and not found.
- GitHub: No public repository located. CoinGecko lists empty GitHub repository list for the project.

**Deployment:**
Contract code is present and verified as ERC-20. No CREATE opcode record found in blocks 0–1,000,000 (indicating deployment after that block). Full deployment record would require scanning from actual deployment block. No claimed deployment information in public documentation.

---

## What the Reports Do Not Cover

All three reports state findings on what they examined. Where findings are silent, the absence is itself a finding:

- No audit documentation exists (business report, negative finding)
- No team is publicly identifiable (business report, negative finding)  
- No GitHub repository is public (business report, negative finding)
- No accessible project website claims can be verified (business report, negative finding)

Market report focuses solely on pricing, liquidity, and volume; it carries no team, organization, or audit information.

Tokenomics report focuses solely on supply, mint/burn status, and holder distribution; it carries no market data or organization information. Transfer log analysis was bounded to blocks 0–9,999,999. Mints or burns after block 10,000,000 were not examined; the chain head is above block 93,000,000.

---

## Data Sources Summary

**Market Report Sources:**
- Contract state: cast call against Robinhood mainnet (chainId 4663)
- Price, liquidity, volume, pair reserves, transaction counts: DexScreener API https://api.dexscreener.com/latest/dex/tokens/0x39dBED3a2bd333467115dE45665cC57F813C4571

**Business Report Sources:**
- On-chain verification: Robinhood mainnet (4663), cast calls to contract
- Token metadata: CoinGecko API (accessed 2026-10-20)
- Organization research: pons.io website, LinkedIn, GitHub APIs
- Transfer history: eth_getLogs via Robinhood RPC, blocks 93,256,000–93,356,000 (100,000-block window)
- Documentation: Google search, direct site access attempts

**Tokenomics Report Sources:**
- Contract state: cast calls via Robinhood mainnet (chainId 4663)
- Transfer log analysis: 10M-block window (blocks 0–9,999,999) due to RPC query limits
- Balances: balanceOf() calls read directly from contract

**Synthesis Verification (conducted 2026-10-20 on Robinhood mainnet, chainId 4663, via read-only queries):**
- Burn address Transfer events: eth_getLogs search for transfers to 0x000000000000000000000000000000000000dead and 0x0000000000000000000000000000000000000000 in blocks 0x0–0x989680
- Genesis mint transaction: eth_getTransactionReceipt for hash 0x1f54f25fec2d963dcb338ecb8b46a6eb123198a5c7a746d34cb2dbe78d074af8
- Block data: cast block 8963150

---
---

*Synthesis completed. This document carries three specialist reports into one. Every figure named here is attributed to its source; bare figures are identified with the report they came from. Five disagreements have been flagged: transfer event counts (5,965 vs. 6,062), burn transfers (Tokenomics: none detected vs. Business: at least one confirmed), DEX listings (Business: none vs. Market: four pools), CoinGecko rank (#195 vs. #196), and mint hash (block hash vs. transaction hash). No inference has been added beyond what the three reports state.*
