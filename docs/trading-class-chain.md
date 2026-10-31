# The trading class chain

The second scenario. Where [the research chain](research-chain.md) ran on one
client paying for one report, this one runs on a **KOL**: an agent whose
product is attention. It borrows to have a trading class built, sells seats in
the class to the four agents who wrote the last chain's research, sells
promotion to the two agents who have something to sell, and repays the loan out
of the first promotion fee.

Nobody coordinates it. Each agent mints the covenant describing what it will do
for whom, and the chain assembles itself out of agents finding work they can
perform.

Everything in the source story is denominated in "usdc". **Settlement is USDG**
— the ERC-20 at `0xc44DB72f7d3185b6AAA7907434592EB7689D0100`, six decimals, on
Robinhood testnet 46630. There is no USDC in this system and the amounts below
are USDG throughout.

## The cast

| Agent | Who | Role in this chain | Mints | Performs |
| --- | --- | --- | --- | --- |
| `kol` | **new seat** | the hub — borrows, commissions a site, sells a class, sells promotion, repays | 7 covenants | the developer's website ask |
| `developer` | Hale | builds the class website, buys promotion, builds the lender's contract | 2 covenants | the kol's second promo ask |
| `lender` | Gray | funds the kol at 500→600, then spends the margin on a contract | — | the kol's loan ask, the developer's contract ask |
| `analyst` | Vale | buys promotion for the report generator | — | the kol's first promo ask |
| `market` | Kit | buys a seat in the class | — | one class ask |
| `business` | Marlowe | buys a seat | — | one class ask |
| `tokenomics` | Calder | buys a seat | — | one class ask |
| `synthesizer` | Reeve | buys a seat | — | one class ask |
| `validator` | — | closes covenants once both legs check out | — | — |

Note what the money says about the shape: the analyst and the developer are
**productising the last chain**. Vale is selling the research chain itself as a
token research report generator; Hale is selling the thing he is about to build
for the kol as a token website builder. Both pay the kol 600 to be seen. The
four researchers are the kol's customers rather than its suppliers — this chain
inverts the last one.

### The empty seat

`trader kol` in the source story is not Sloane. Sloane's character is explicit
that she does not nudge, does not accept a recommendation in place of data, and
is the client rather than a participant — a paid promoter is the opposite
posture, and overwriting `agents/trader/system.md` would destroy a character
the last scenario still needs.

So this needs a ninth directory, `agents/kol/`, with a new name in the same
register as Vale, Gray, Hale, Reeve and Calder. **Mercer** is the suggestion: a
mercer dealt in fine cloth and sold on presentation, which is the job. Nothing
in this document depends on the name — swap it before the character file is
written and nothing else changes.

## The covenants

The minter is always the party who goes **second**, because Kudo gates the
promise on the ask. Every covenant here is therefore pay-first: nine covenants,
no INVOICE among them.

| # | Minter | Type | Ask (counterparty, first) | Promise (minter, second) | Counterparty | Window |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kol` | LOAN | 500 USDG lent | 600 USDG repaid | `lender` | **24 h** |
| 2 | `developer` | ADVANCE | 500 USDG | one web page: source, plus the command that runs it and what was seen | `kol` | 4 h |
| 3 | `kol` | ADVANCE | 100 USDG | trading class material | `market` | 1 h |
| 4 | `kol` | ADVANCE | 100 USDG | trading class material | `business` | 1 h |
| 5 | `kol` | ADVANCE | 100 USDG | trading class material | `tokenomics` | 1 h |
| 6 | `kol` | ADVANCE | 100 USDG | trading class material | `synthesizer` | 1 h |
| 7 | `kol` | ADVANCE | 600 USDG | a promotional post on X about the named project | `analyst` | 30 min |
| 8 | `kol` | ADVANCE | 600 USDG | a promotional post on X about the named project | `developer` | 30 min |
| 9 | `developer` | ADVANCE | 190 USDG | smart contract source, a testnet address, and a call proving it | `lender` | **12 h** |

**The exact `ask` and `promise` strings for all nine are in
[covenants.md](covenants.md)**, ready to mint. The mint and settle commands,
and what each leg settles with, are in [covenant-text.md](covenant-text.md).

All nine are standing offers: no text names a counterparty, and the brief
arrives in `promiseDetail` when the ask is attested. The "taken by" column is
who is expected to claim each one, not who is written into it — seat 1 goes to
whoever attests it first.

Covenants 3–6 are four distinct mints and 7–8 are two, numbered by seat and by
slot rather than left identical. Four covenants reading the same words are
indistinguishable in a listing, and a buyer who has paid for one of them
cannot say which. Covenants 2 and 9 are open in the same way — "any web page
code", "any smart contract code" — which is why the PRDs below exist.

**The loan window has to nest around almost everything.** The kol cannot repay
until the first promotion fee lands, which cannot happen until the class exists
and the analyst has somewhere to be promoted to, which needs the website first.
Twenty-four hours is the outer bound on covenants 2 through 7 running in
sequence. The contract at #9 is outside the loan entirely and gets 12 hours
because a contract with a passing test is more work than a report.

Every window runs from `askSettledAt`, not from the mint.

## The sequence

```
lender      → kol's loan ask            500 USDG lent
kol         → developer's website ask   500 USDG + the website spec
developer   → the website                                          settled
kol         mints the class offer ×4
market      → class ask                 100 USDG   → material      settled
business    → class ask                 100 USDG   → material      settled
tokenomics  → class ask                 100 USDG   → material      settled
synthesizer → class ask                 100 USDG   → material      settled
kol         mints the first promo offer
analyst     → promo ask                 600 USDG + the promo brief
kol         → the post                                             settled
kol         repays lender               600 USDG                   settled
kol         mints the second promo offer
developer   → promo ask                 600 USDG + the promo brief
kol         → the post                                             settled
lender      → developer's contract ask  190 USDG + the contract spec
developer   → the contract                                         settled
```

Two ordering constraints that are not obvious from the story:

- **The class offers are minted after the website lands**, not before. The
  material is what the site hosts; minting the offer earlier starts a 1-hour
  clock on a promise the kol cannot yet keep.
- **The second promo offer is minted after the first is closed.** Both read
  identically and neither names a counterparty, so two open at once can be
  claimed twice by the same party, or by a researcher who has no project to
  promote. `_common.md` already warns that an unusually large promise means the
  ask wants something you are not the party to supply; one at a time removes
  the ambiguity instead of relying on everyone reading that paragraph.

## Where the money ends up

| Agent | In | Out | Net | Also holds |
| --- | --- | --- | --- | --- |
| `kol` | 500 loan, 400 class, 1,200 promotion | 500 website, 600 repayment | **+1,000** | a website |
| `developer` | 500 website, 190 contract | 600 promotion | **+90** | two posts' worth of reach |
| `lender` | 600 repayment | 500 loan, 190 contract | **−90** | the basket contract |
| `analyst` | — | 600 promotion | **−600** | one post |
| `market` `business` `tokenomics` `synthesizer` | — | 100 each | **−100 each** | the class material |

The kol takes 1,000 for carrying the only risk in the chain — it spends the
whole loan on the website before a single customer has paid.

### Funding this is not free, and the story does not cover it

Three balances have to exist before any of this can run, and nothing in this
chain creates them:

- `lender` needs **500 USDG** before covenant 1, and 190 more later than it has
  margin for — it ends 90 down. Gray is buying an asset with it, not losing it,
  but the balance has to be there.
- `analyst` needs **600 USDG** and earns nothing here. The research chain paid
  Vale 10.
- `developer` receives 500 before it pays 600, so it needs **100 of its own**
  at that moment, recovered later from the 190.
- The four researchers need **100 each**. The research chain paid them 10 each.

So the four researchers and the analyst are between 10x and 60x short on what
the last chain paid them. Either they are funded out of band before this runs,
or the amounts come down by roughly an order of magnitude — 10 a seat, 60 a
promotion, 50 the loan — which preserves every ratio in the story. **That is a
decision for whoever runs it, not something to discover at the first revert.**

The kol itself is at zero USDG between paying the developer and the first class
sale, and every attestation after that point is a transaction. It needs ETH for
gas that is not in any of these covenants.

## What the specs are for

Four of the nine covenants ask for work whose definition does not fit in a
covenant's text, and two of those are standing offers that name no subject at
all. `promiseDetail` is the only channel from the counterparty back to the
minter, and it is one short string carrying a payment address.

So the brief goes in a **public gist** and `promiseDetail` carries its URL,
exactly as a report does. The spec is written before the ask is attested, by
the party commissioning the work, and it does not change after its URL is
attested — same rule as a report, for the same reason.

| PRD | Author | Reaches | Via |
| --- | --- | --- | --- |
| [trading class website](../specs/trading-class-website.md) | `kol` | `developer` | `promiseDetail` of #2 |
| [trading class material](../specs/trading-class-material.md) | `kol` | the four buyers | published alongside the offer |
| [promo: token research report generator](../specs/promo-token-research-report-generator.md) | `analyst` | `kol` | `promiseDetail` of #7 |
| [promo: token website builder](../specs/promo-token-website-builder.md) | `developer` | `kol` | `promiseDetail` of #8 |
| [cNFT loan basket contract](../specs/cnft-loan-basket-contract.md) | `lender` | `developer` | `promiseDetail` of #9 |

The class material spec is the odd one: the kol is both author and performer,
because the class is a product rather than a commission. It is published so
that four buyers can see what 100 USDG buys before they pay, and so the
validator has something to check the delivery against.

## Promotion without advice

`_common.md` forbids every agent here from telling anyone to buy, sell or hold,
and from calling a token a good or bad investment. A chain whose hub is paid to
promote things has to live inside that rule.

**The line is the recommendation, not the subject.** A post may name a token,
say what it is, who is behind it and what it does — those are claims about the
world, and the rest of this cast makes them in every report it writes. What it
may never do is attach a price, a direction or a judgement to any of it. So the
promotion slots take a token project as readily as a tool, and the refusal
lives in the promise instead: *disclosed as paid, no price, no direction, no
advice*, written into permanent covenant text before any brief exists.

A commissioner may be stricter than the covenant, and both of these are. Vale
rules out naming a token because a post pairing a service with a ticker reads
as a call on the ticker; Hale rules it out because his product generates pages
about tokens and naming one would make the post about that token rather than
about the generator. Those are their choices in their own briefs, not terms the
kol imposes.

Every paid post discloses that it is paid, and carries the scenario's fiction
label like any other post in this cast.

## What this repo needs

- `agents/kol/system.md` and `agent-card.json` for the ninth seat, and a name.
  Neither the `kol` nor the `developer` has an on-chain address yet, which is
  why every covenant text pays `agentWallet` rather than a literal address.
- **`take-work` for six more agents.** In the research chain only the analyst
  and the lender performed other agents' asks. Here the four researchers, the
  analyst and the kol all do, so `agents/README.md`'s JOBS table needs
  `take-work` added for `kol`, `analyst`, `market`, `business`, `tokenomics`
  and `synthesizer`, at pairwise non-multiple intervals like the rest.
- The five specs published as gists, and their URLs in the briefs.
- Funding, per the section above, or the amounts scaled down.
- `forge` is still not in the image, so covenant 9 cannot be compiled inside a
  CVM. Hale's character already says to publish the source, name the step he
  could not perform, and stop — the lender's spec has to accept that as
  performance or the covenant has to be driven locally.
