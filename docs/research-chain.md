# The research chain

A trader wants a research report on one token. No single agent writes it.
Instead a chain of covenants forms: an analyst borrows to commission three
specialist reports, pays a synthesizer to combine them, delivers the result,
and the money unwinds back down the chain with interest.

Nobody coordinates it. Each agent mints the covenant describing what it will
do for whom, and the chain assembles itself out of agents finding work they
can perform.

## The cast

| Agent | Who | Role | Mints | Performs |
| --- | --- | --- | --- | --- |
| `analyst` | Vale | Token analyst — the general contractor | a LOAN for 40 | every other agent's ask |
| `synthesizer` | Reeve | Combines three reports into one | an ADVANCE for the synthesis | — |
| `market` | Kit | Market research | an ADVANCE for market research | — |
| `business` | Marlowe | Business research | an ADVANCE for business research | — |
| `tokenomics` | Calder | Tokenomics research | an ADVANCE for tokenomics research | — |
| `lender` | Gray | Lends to the analyst | a LOAN for 100 | the analyst's loan ask |
| `trader` | Sloane | Wants the report, holds 100 USDG | an INVOICE for the report | — |
| *human* | — | Funds the lender. Driven by hand, not an agent | — | the lender's loan ask |

The characters are the Follow the Money cast repurposed, which is why the
directory is the role and the name is in the card: the slot is what the chain
needs, the character is who fills it. Vale, Sloane, Kit and Gray come over
directly; Marlowe was named throughout that scenario and never had a directory.

Two seats had no character to inherit, so they got new names in the same
register: **Reeve** on the synthesis — a reeve reconciled accounts and answered
for the discrepancies, which is the job — and **Calder** on tokenomics. The
synthesizer is that cast's informant recast; Shinichi, its original name, is
what the protocol itself is named after and belongs to Kudo rather than to one
agent inside it.

Seven agents. The `validator` closes covenants as it does in any scenario and
is not part of the chain.

## The covenants

The minter is always the party who goes **second**, because Kudo gates the
promise on the ask. That fixes every type:

| Minter | Type | Ask (first) | Promise (second) | Promise window |
| --- | --- | --- | --- | --- |
| `trader` | INVOICE | a Pons research report | 100 USDG | 30 minutes |
| `market` | ADVANCE | 10 USDG | market research on the named token | 30 minutes |
| `business` | ADVANCE | 10 USDG | business research on the named token | 30 minutes |
| `tokenomics` | ADVANCE | 10 USDG | tokenomics research on the named token | 30 minutes |
| `synthesizer` | ADVANCE | 10 USDG | a synthesized report of the three handed over | 30 minutes |
| `analyst` | LOAN | 40 USDG | 50 USDG | **12 hours** |
| `lender` | LOAN | 100 USDG | 101 USDG | **24 hours** |

**The two loan windows are long on purpose, and they nest.** A loan sits
outside the work it funds: the analyst cannot repay until the trader has paid,
which cannot happen until the synthesis exists, which needs three reports
first. Give the loans a 30-minute window like the rest and they break after
everything else succeeded.

Each window is measured from when that covenant's own ask is attested — which
is why the outer loan gets the longer one. The lender's ask is attested first,
so its clock starts first, and it cannot repay the human until the analyst has
repaid it. Equal windows would put the lender in default while the analyst was
still comfortably inside its own.

## The sequence

```
human       → lender's ask        100 USDG lent
lender      → analyst's ask        40 USDG lent
analyst     → market's ask         10 USDG      → market report      settled
analyst     → business's ask       10 USDG      → business report    settled
analyst     → tokenomics's ask     10 USDG      → tokenomics report  settled
analyst     → synthesizer's ask    10 USDG + 3 reports → synthesis   settled
analyst     → trader's ask         the report   → 100 USDG           settled
analyst     repays lender          50 USDG                           settled
lender      repays human          101 USDG                           settled
```

The three specialist asks can be performed in any order or in parallel.

## Where the money ends up

The trader and the human put in 100 USDG each. Analyst borrows 40, spends 40,
earns 100, repays 50 — **+10**. Lender borrows 100, lends 40, collects 50,
repays 101 — **+9**. Human **+1**. Each researcher and the synthesizer **+10**.
The trader has the report.

## Two conventions this scenario needs

### Settlement data is free-form text

`askSettlementData` and `promiseSettlementData` are strings and nothing
constrains their shape. An ask that wants several things is attested with one
string describing all of them:

> "Paid 10 USDG in 0xabc… . Market report: https://… Business report:
> https://… Tokenomics report: https://… "

The validator reads it and checks each part. Do not invent a schema; write it
so a reader can follow it, and include every hash and URL in full.

### The ask's parameters live in `promiseDetail`

Three of these covenants promise research on "the named token" rather than on
Pons specifically, because they are standing offers — they were minted before
anyone knew which token would be asked about.

The party performing the ask writes the parameter into `promiseDetail` when
they attest it: *"Research Pons. Pay to 0x…"*. That field is the only channel
from the counterparty back to the minter, and it already carries the payment
address, so it carries the brief too.

An agent whose promise depends on a parameter **must read `promiseDetail`
before starting work**. If it is empty and the promise cannot be performed
without it, say so and do nothing rather than guessing a token.

## Chain

Robinhood Chain testnet, chainId 46630. Settlement is USDG, an ERC-20 at
`0xc44DB72f7d3185b6AAA7907434592EB7689D0100`, six decimals, so 10 USDG is
`10000000`. ETH is gas only.

## What this repo needs

Done:

- Seven character files and cards: `analyst`, `synthesizer`, `market`,
  `business`, `tokenomics`, `lender`, `trader`. The Follow the Money
  directories are retired; `validator` stays, with its references to the
  theft replaced.
- `agents/_common.md` has lost the Vault theft and gained this chain, the
  promise windows and both conventions above.
- Reports are published as public gists, settled with the gist's raw revision
  URL. `.claude/skills/github-gists/` has the call and the pre-flight,
  `GITHUB_TOKEN` is documented and warned about at startup, and the five
  agents that publish carry the skill.
- `prompts/take-work.txt` reads `promiseDetail` for the brief, and
  `prompts/settle-due.txt` and the validator check every part of a compound
  settlement string.

Outstanding:

- A new prompt for the analyst, which is the only agent that both performs
  asks and owes promises across the whole chain. Until it exists the analyst
  runs the shared `take-work` and `settle-due`, which cover both halves of its
  work without sequencing them.
- A `GITHUB_TOKEN` with the `gist` scope, in each publishing agent's
  environment.
- Wallets, funding, `AGENT_ROLE` and ERC-8004 identities for seven agents.
