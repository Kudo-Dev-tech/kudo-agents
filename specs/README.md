# specs/

A PRD for an ask whose definition does not fit in a covenant's text.

**These are requirements, not designs.** Each one says what the thing has to
do, who for, and how its author will know it is done. How it is built is the
builder's call — a commissioner who specifies the implementation has paid for
a typist.

Four covenants in [the trading class chain](../docs/trading-class-chain.md)
ask for work, and two of those are standing offers that name no subject at all
— "any web page code", "any smart contract code". `promiseDetail` is the only
channel from the counterparty back to the minter, and it is one short string
that already carries a payment address.

So the brief goes in a **public gist** and `promiseDetail` carries its URL:

> Paid 500 USDG in 0xabc… . Spec: https://gist.github.com/…  Pay me at 0xdef…

The rules are a report's rules, for a report's reasons.

- **The commissioning party writes it**, before attesting the ask. A spec that
  arrives after work has started is a renegotiation, and covenant text is
  permanent.
- **Never edit a spec whose URL has been attested.** The gist URL follows the
  gist rather than pinning a revision; what keeps it honest is the public
  revision history. A spec that changed after the work was priced is the same
  failure as a report that changed after it was judged.
- **No placeholder survives publication.** Every URL, address and figure in a
  spec is one the author fetched. If a fact is not available yet, the spec is
  not ready to publish — it does not get published with `<TBD>` in it and
  filled in later.
- **Acceptance criteria are what the validator reads.** A spec that cannot be
  checked by someone who was not in the conversation has not specified
  anything.

The files here are the drafts, in the repo, where they can be reviewed before
they become permanent. Publishing is a separate step.

The covenants these attach to are in
[docs/covenants.md](../docs/covenants.md); how to mint and settle them is in
[docs/covenant-text.md](../docs/covenant-text.md).

| Spec | Author | For | Covenant |
| --- | --- | --- | --- |
| [trading-class-website.md](trading-class-website.md) | `kol` | `developer` | #2, 500 USDG |
| [trading-class-material.md](trading-class-material.md) | `kol` | the four buyers | #3–#6, 100 USDG each |
| [promo-token-research-report-generator.md](promo-token-research-report-generator.md) | `analyst` | `kol` | #7, 600 USDG |
| [promo-token-website-builder.md](promo-token-website-builder.md) | `developer` | `kol` | #8, 600 USDG |
| [cnft-loan-basket-contract.md](cnft-loan-basket-contract.md) | `lender` | `developer` | #9, 190 USDG |

## The research chain

| Covenant | Spec |
| --- | --- |
| 3 `market` | [token-market-research.md](token-market-research.md) — the external market, not the token |
| 4 `business` | [token-business-research.md](token-business-research.md) — the product and its business model |
| 5 `tokenomics` | [token-tokenomics-research.md](token-tokenomics-research.md) — supply, allocation, unlocks, utility, value accrual |
| 6 `synthesizer` | [token-research-synthesis.md](token-research-synthesis.md) — the three combined |
| 7 `trader` | [token-research-report.md](token-research-report.md) — the client-facing brief |

Covenants 1 and 2 are loans and have no spec. Texts are in
[docs/research-covenants.md](../docs/research-covenants.md).
