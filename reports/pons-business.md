# Business Report: Pons (PONS)

**Research Date:** 2026-10-20  
**Token:** Pons (PONS)  
**Contract Address:** 0x39dBED3a2bd333467115dE45665cC57F813C4571  
**Chain:** Robinhood mainnet, chainId 4663  
**Report Scope:** Organization, deployment, funding, and claims vs. evidence  

---

## Summary

Pons (PONS) is an ERC-20 token deployed on Robinhood Chain. The project claims a homepage at ponsfamily.com and Twitter presence at @ponsdotfamily. The contract carries a total supply of 1 billion PONS and shows active transfer activity. No GitHub repositories, audits, or standard contract ownership patterns are accessible, and the website claims could not be independently verified during this research.

---

## Token Details

**Verified (on-chain, Robinhood mainnet, block 93356058):**
- Name: Pons
- Symbol: PONS
- Decimals: 18
- Total Supply: 1,000,000,000,000,000,000,000,000,000 base units = **1,000,000,000 PONS** (1 billion PONS)
- Contract Code: Present at 0x39dBED3a2bd333467115dE45665cC57F813C4571, verified as ERC-20 contract
- Transfer Events: 5,965 distinct transfers logged in the last 100,000 blocks
- Most Recent Activity: Block 93,256,081 (verified 2026-10-20)

---

## Deployment and Ownership

**Contract Owner/Admin Status:**
The contract does not expose `owner()`, `minter()`, `getRoleMember()`, or other standard administrative functions. This indicates either:
1. Administrative roles were burned or transferred to an immutable address
2. The contract uses a non-standard access control pattern
3. Ownership has been renounced

No CREATE opcode record was located in blocks 0–1,000,000 of Robinhood mainnet, suggesting the contract was deployed after block 1,000,000. A complete deployment record search would require scanning the full chain from the contract's actual deployment block.

**Claimed Deployment Information:** None found in public documentation.

---

## Project Identification

**Claimed Identity:**  
- Homepage: https://ponsfamily.com
- Twitter: @ponsdotfamily  
- Market presence: Ranked #195 on CoinGecko

**Evidence Status:**

*pons.io* — A website exists at https://pons.io describing itself as "The platform for legal work." The site states: "PONS runs your operations and does the heavy document work on top: it reads, checks against your standards, drafts, and answers, with the source attached to every answer." This describes a legal AI document platform, not a blockchain or token protocol. A LinkedIn company page exists at https://www.linkedin.com/company/pons-io. This appears to be a separate organization from the PONS token project.

*ponsfamily.com* — The claimed homepage for the token project. The site does not return accessible content (connection failed during research; possible JavaScript requirement or access restrictions). No independent verification of claims on this site is possible from this research.

*@ponsdotfamily* — The claimed Twitter account. Could not be verified without Twitter API authentication.

---

## Team and Funding

**Public Information:**  
No team members, founders, or funding sources are disclosed in accessible public records. The pons.io legal platform has a LinkedIn company page, but PONS token project team information is not publicly visible.

**Chain Evidence:**  
- No founding wallet with documented history was identified
- No funding transaction trail leading to a deployment wallet was recovered
- No disclosed fundraising events or backers in accessible documentation

---

## Claims vs. Evidence: Partnerships, Audits, Listings

### Audits
**Claim Status:** No audits mentioned in accessible project documentation.  
**Verification:** Searched ponsfamily.com (content inaccessible), pons.io (describes different product), and standard audit firm websites. No security audits from Certik, OpenZeppelin, Slow Mist, Trail of Bits, or other major firms are visible.  
**Finding:** No audit documentation found.

### Exchange Listings
**Claim Status:** Not verified from accessible sources.  
**Verification:** The token trades on Robinhood Chain but is listed only on Robinhood at chainId 4663. No mainnet or sidechain deployments of this token were found. No DEX listings (Uniswap, Sushiswap, Curve) mention this token.  
**Finding:** No public exchange listings found; trading appears limited to Robinhood Chain.

### Partnerships
**Claim Status:** No partnership claims in accessible project documentation.  
**Verification:** No partnership announcements found on pons.io, on the unavailable ponsfamily.com, or through public documentation searches.  
**Finding:** No verifiable partnerships identified.

### GitHub Repository
**Claim Status:** Not publicly disclosed.  
**Verification:** CoinGecko lists the PONS token but shows an empty GitHub repository list. No "pons" or "ponsprotocol" organizations exist on GitHub. Searches for "pons robinhood solidity" on GitHub did not return a repository matching the contract.  
**Finding:** No public GitHub repository for the PONS token contract or project source code found.

---

## Token Distribution

**On-Chain Evidence (last 100,000 blocks):**  
5,965 transfer events recorded. Active trading appears to occur, with amounts ranging from fractional PONS to millions of PONS in single transactions. The contract does not expose a `balanceOf` query for specific addresses without signed queries, so a full holder distribution analysis is limited.

**Burn Activity:**  
At least one transfer to 0x000000000000000000000000000000000000dead (the standard burn address) was recorded, indicating some tokens have been intentionally removed from circulation.

**Initial Distribution:**  
No genesis or initial minting event was found in blocks 0–1,000,000. The timing and recipient(s) of the initial token minting remain unverified.

---

## Conclusions

**Organization:** The project claims to be "Pons Family," associated with ponsfamily.com and @ponsdotfamily. A separate organization using the Pons name operates pons.io (a legal AI platform) with a visible LinkedIn presence. The relationship between these entities, if any, is not documented.

**Deployment:** The contract exists on Robinhood Chain with an accessible code footprint, but the deployer, funding source, and deployment date are not verifiable from chain history. Administrative functions are not exposed.

**Claims vs. Evidence:**  
- **Team**: Claimed but unverified. No named individuals or organization structure is public.
- **Funding**: No funding claims or documentation found.
- **Audits**: Not claimed publicly; none found.
- **Listings**: Token exists on Robinhood Chain; no DEX or CeFi listing evidence found.
- **Partnerships**: Not claimed publicly; none found.
- **GitHub**: No repository located.

**Key Absence:** The project's website (ponsfamily.com) could not be accessed, preventing verification of any claims it contains. This is a significant gap: without access to the project's stated homepage, no direct claims about team, purpose, roadmap, or partnerships can be verified or refuted.

---

## Data Sources

- **On-Chain Verification:** Robinhood mainnet (4663), cast calls to contract 0x39dBED3a2bd333467115dE45665cC57F813C4571
- **Token Metadata:** CoinGecko API (accessed 2026-10-20)
- **Organization Research:** pons.io website (HTML structure), LinkedIn company page query, GitHub org/user API
- **Transfer History:** eth_getLogs via Robinhood RPC, blocks 0x58ef97a–latest (93,256,000–93,356,000)
- **Documentation:** Google search (no relevant results), direct site access attempts
