# The seven covenants — research chain

Exact `ask` and `promise` strings for
[the research chain](research-chain.md), ready to mint.

Each text carries its amount, its window and what settles it. What the work
has to contain is in [the PRDs](../specs/README.md), reached by a URL in
`promiseDetail`.

## The seven

| # | Minter | Type | Taken by | Ask | Promise |
| --- | --- | --- | --- | --- | --- |
| 1 | `lender` | LOAN | *human* | Lend 1000 USDG to this covenant agentWallet, and name the address you want repaying at. | I will return 1010 USDG within 24 hours of this ask being attested. |
| 2 | `analyst` | LOAN | `lender` | A loan of 400 USDG to this covenant agentWallet. Name where to repay. | Repayment of 500 USDG within 12 hours of this ask being attested. |
| 3 | `market` | ADVANCE | `analyst` | 100 USDG to this covenant agentWallet buys one market report. Send the spec URL and the token with your payment. | Market report published within 30 minutes of this ask being attested, settled with the gist URL. |
| 4 | `business` | ADVANCE | `analyst` | One business report for 100 USDG to this covenant agentWallet. Spec URL and token with the payment. | Business report filed within 30 minutes of this ask being attested and settled with its gist URL. |
| 5 | `tokenomics` | ADVANCE | `analyst` | 100 USDG to this covenant agentWallet for one tokenomics report. Send the spec URL and the token. | Within 30 minutes of this ask being attested I will publish the tokenomics report and settle with the gist URL. |
| 6 | `synthesizer` | ADVANCE | `analyst` | 100 USDG to this covenant agentWallet, with the three source reports and the spec URL, buys one synthesis. | One synthesis of the reports handed to me, published within 30 minutes of this ask being attested and settled with its gist URL. |
| 7 | `trader` | INVOICE | `analyst` | A research report on the token named in the spec, covering market, business and tokenomics, published at a public URL. | Payment of 1000 USDG within 30 minutes of the report being settled. |

## Which spec goes with which covenant

The spec URL travels in `promiseDetail`, written by the party attesting the
ask. Covenants 1 and 2 are loans and need no spec — their terms are wholly in
their text, and `promiseDetail` carries only the repayment address.

| # | Minter | What is bought | Spec | `promiseDetail` also carries |
| --- | --- | --- | --- | --- |
| 1 | `lender` | 1000 USDG, lent | — | the address to repay |
| 2 | `analyst` | 400 USDG, lent | — | the address to repay |
| 3 | `market` | external market research | [token-market-research.md](../specs/token-market-research.md) | the address to pay |
| 4 | `business` | the product and its business model | [token-business-research.md](../specs/token-business-research.md) | the address to pay |
| 5 | `tokenomics` | supply, allocation, unlocks, utility, value accrual | [token-tokenomics-research.md](../specs/token-tokenomics-research.md) | the address to pay |
| 6 | `synthesizer` | the three reports combined into one | [token-research-synthesis.md](../specs/token-research-synthesis.md) | the three report URLs, address to pay |
| 7 | `trader` | the finished report | [token-research-report.md](../specs/token-research-report.md) | the address to pay the analyst |

The three research lanes do not overlap, and each spec says what the other two
cover so a researcher who strays knows it:

- **market** is about the sector, *not* the token
- **business** is about the product and where revenue comes from
- **tokenomics** is about the token economy — allocation, unlocks, utility,
  value accrual

Every spec names its subject outright — Pons, its contract address and its
chain. Nothing about what to research arrives at attestation; the spec URL
settles that, and the only other thing a counterparty has to send is where to
be paid.

## Why the windows differ

Five of these are half an hour. Two are twelve and twenty-four.

A loan sits outside the work it funds. The analyst cannot repay until the
trader has paid, which cannot happen until the synthesis exists, which needs
three reports first. Measured from its own ask, covenant 2 has to survive
covenants 3 through 7, and covenant 1 has to survive covenant 2 as well.

Give the loans thirty minutes like the rest and they break after everything
else has succeeded. The first run took about an hour end to end, against those
windows.

## The order

Covenants 1 and 2 are minted and funded first, because the analyst has no
money of its own. Then 3, 4 and 5 can be taken in any order or at once. Then 6,
once the three reports exist to hand over. Then 7.

Nothing stops 3 to 7 being minted early — they are standing offers and sit
unclaimed until the analyst has funds. What cannot happen early is the
attestation.

## Two things about this text

**No apostrophes, anywhere.** An apostrophe inside a single-quoted shell
argument ends the quoting, and that has already put a covenant on chain
reading `I'\''ll pay 4 USDG`, unremovable. Heredocs fix it, but writing "I
will" means the text survives being pasted somewhere a heredoc is not.

**The token is never named in the covenant text.** Covenants 3 to 6 are
standing offers, written so the same text can be reused for a different
subject later. What they are about this time is in the spec, and the spec URL
is what `promiseDetail` carries. An agent reads the spec before starting, and
refuses rather than guessing if no URL arrived.
