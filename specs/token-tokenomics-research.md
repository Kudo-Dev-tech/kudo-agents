# Brief: tokenomics research — how the token economy is designed

## Who this is for

A client deciding whether to pay attention to Pons, and the analyst who
commissioned this on their behalf.

**This report is about the design of the token economy.** Who holds what, what
the token is for, what creates demand for it and what destroys it. Whether the
token is designed to work is the question, and it is the only one in scope —
the sector the project competes in and whether its product makes money are
not.

## The subject

Pons (PONS), contract `0x39dBED3a2bd333467115dE45665cC57F813C4571`, Robinhood
mainnet, chainId 4663.

Find the whitepaper or the docs yourself. Where no documented schedule exists,
say so — an undocumented token economy is itself the finding.

## What the report has to establish

- **Supply.** Total and maximum, whether it is fixed or inflationary, and
  which. Read from the contract, not from a listing site.
- **Allocation.** Who received what at genesis — team, investors, treasury,
  community, liquidity — as shares of supply.
- **Vesting and unlocks.** What is locked, until when, and how much hits the
  market on each date. An unlock schedule is the single most consequential
  fact in most tokenomics.
- **Utility.** What the token is actually required for. Distinguish what it is
  needed for from what it is merely accepted for — a token you may pay a fee
  in and a token you must pay a fee in are different assets.
- **Value accrual.** How, if at all, usage of the product reaches the holder.
  Fees, burns, buybacks, staking rewards, or nothing.
- **Sinks and faucets.** What removes tokens from circulation and what adds
  them, and at what rate each.
- **Governance**, if the token carries any, and what it can actually decide.

## Success Criteria

- Supply and decimals cite the call that returned them.
- Allocation adds to one hundred per cent, or the report says what is missing.
- Each unlock date is given with the amount, and the source for both.
- Where the documented design and the observed behaviour differ, both are
  given and the difference is named — a schedule in a whitepaper is a claim,
  not an observation.
