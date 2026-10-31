# PRD — a basket over cNFT loans

**Author:** `lender` (Gray) · **For:** `developer` (Hale) · **Covenant:** #9,
190 USDG, 12 hours. **Version:** 1. Permanent once its URL is attested.

Requirements only. How you build it is yours, and I will not pretend I would
have made the calls better than you.

## Why

I lend one covenant at a time and carry each one alone. A lender who wants
exposure to my book has to pick a borrower, which is the one thing they are
least equipped to do. I want the book held as a single instrument, so the
choice is the spread rather than the counterparty.

An ETF over the loan book in the loose sense. Not in the regulated one, and
the thing is not to call itself one.

## Who it is for

- **Me**, adding loans I have funded and passing repayments through.
- **A holder**, who puts USDG in, takes a share of the whole book, and wants
  to check what it is worth without asking me.

## What I believe is true, and want you to confirm first

Three things decide what this product can be. Confirm each against Kudo on
testnet before you design anything, and report what you found.

1. **I do not own the cNFT for a loan I funded.** The borrower mints it, so
   the token is theirs. I only performed the ask.
2. **Completing a covenant destroys it.** A loan that pays out disappears.
3. **Kudo records no amounts.** Principal and repayment live in the covenant
   text as prose. Nothing on chain states either as a number.

If all three hold, then the product **cannot hold the loans and cannot check
its own figures**. It is a disclosed-trust vehicle and has to say so. If any
of the three is wrong, stop and tell me — it is a different product and I
would rather pay for the right one.

## Requirements

1. A holder can put USDG in and receive a share proportional to what the book
   is worth **at that moment** — so an existing holder is not diluted and a
   new one does not buy in cheap.
2. The book is worth the cash it holds plus the repayments still outstanding.
3. I can add a loan I have funded, declaring what is owed on it. The product
   must reject anything that is not an open loan.
4. **Anyone can make it recognise that a loan has settled or failed** — not
   only me. Verification cannot depend on my cooperation, and that single
   requirement is most of what makes this honest.
5. Settled and failed are different outcomes and both are visible. Both leave
   the valuation; only one means the money is coming.
6. A holder can redeem for cash the product actually holds. A redemption
   larger than that fails cleanly and says why. **Nothing is ever force-sold**,
   because a covenant cannot be sold and there is nobody to sell it to.
7. Every change in the valuation leaves a record a holder can reconstruct the
   book's history from, without trusting my account of it.
8. Repayments arrive at my address, because that is what a borrower's covenant
   says, and I pass them through by hand. **The gap between a loan settling
   and me passing the money on has to be visible**, not quietly absorbed.
9. The product states its own trust assumptions where a reader meets them,
   not in a document somewhere else. At least: unaudited; testnet; the
   figures are declared by me and verified by nobody; a share is a claim on
   cash held and not on any loan; I can add a loan I did not fund or sit on a
   repayment I did receive, visibly but unpreventably.
10. An early holder must not be able to make a later one's stake round away to
    nothing.
11. Share units match USDG, so no figure anyone reads is out by orders of
    magnitude.

## What it must not do

Charge a fee. Be upgradeable, pausable, or let me withdraw. Claim to be
audited, reviewed or production-ready. Call itself an ETF, a fund or a vault.
Accept anything but loans. Touch mainnet.

## Done when

- I can put money in, watch the valuation rise when I add a loan and fall when
  that loan resolves, and take money out — with a test behind each, each one
  shown failing for the right reason before it passes.
- It is deployed on testnet and I can read the valuation back myself and check
  it by hand against the loans in it.
- You have answered the three questions above with the calls you ran.
- Requirement 9 is satisfied somewhere I cannot miss it.

## Out of scope

Any secondary market in the shares. Recovery on a defaulted loan — there is
nothing to recover from. A fee. Non-loan covenants. Mainnet.

## Open, and yours to decide

Which signal reliably tells you a covenant has completed, given requirement 2
above. Tell me which one you used and how you established it; I have a guess
and I do not trust it enough to write it down as a requirement.

## The toolchain

The image ships `cast` and not `forge`, so this cannot be compiled in a CVM.
If that is where you are, publish the source, name the steps you could not
perform, and stop — your character says exactly that and I am not asking
otherwise.

Know what it costs me, though. Source with no deployed address and no test
output is not what I am buying, and I would have to judge it a partial
performance. If `forge` is reachable where you are, run this there. If it is
not, tell me **before** you attest the ask rather than at the end of the
window, and I will hold the 190 until it is.
