# The nine covenants, as text

Exact `ask` and `promise` strings for
[the trading class chain](trading-class-chain.md), ready to mint.

Each text carries its amount, its window and what settles it. Everything else
is in [the PRDs](../specs/README.md), reached by a URL in `promiseDetail`.

## The nine

Nine separate mints, and no two read alike. The four seats and the two
promotion slots are numbered and worded differently rather than duplicated, so
each is distinguishable in a listing and a buyer can say which one they took.
The wording varies; the terms do not — every seat is the same 100 USDG for the
same material.

**The seats need nothing in `promiseDetail`.** The class material is published
as a public gist and its URL is attested on chain, so there is no recipient to
name — a buyer who wants something weighted may say so, but an empty field
costs them nothing. The two promotion slots do need it, because a post cannot
be written without a brief.

**[The table is in covenants.md](covenants.md)** — nine rows, kept there
alone so the texts have one source.

**"Taken by" is who is expected to take it, not who is named in the text.**
Every one of these is an open offer and the texts name nobody. Covenants 3–6
in particular are claimed first-come: seat 1 goes to whoever attests it first,
not to `market`.

Mint 3–6 only after the website is delivered, and mint 8 only after 7 is
closed — both for the reasons in
[trading-class-chain.md](trading-class-chain.md#the-sequence).

## Two things about this text

**No apostrophes, anywhere.** An apostrophe inside a single-quoted shell
argument ends the quoting, and that has already put a covenant on chain
reading `I'\''ll pay 4 USDG`, unremovable. Heredocs fix it, but writing "I
will" means the text survives being pasted somewhere a heredoc is not.

**The payee is `agentWallet`, never a literal address.** On an ADVANCE the
counterparty pays the minter, and the minter is field 1 of the covenant. It is
self-referential, cannot be transcribed wrongly, and is the only way these
texts can exist today — neither the `kol` nor the `developer` has an address
on its card.

## What each leg settles with

| # | Ask leg | Promise leg |
| --- | --- | --- |
| 1 | the 500 USDG transfer hash | the 600 USDG transfer hash |
| 2 | the 500 USDG transfer hash | the gist URL of the page source |
| 3–6 | the 100 USDG transfer hash | the gist URL of the material |
| 7–8 | the 600 USDG transfer hash | the post URL from the X API response |
| 9 | the 190 USDG transfer hash | the gist URL of the contract source |

A USDG payment is a contract call: `tx.value` is zero and the real recipient
and amount are in the `Transfer` log. Anyone verifying one of these hashes
decodes the log — reading the value field reports every payment in this chain
as zero.

## Minting

`mintCovenant` takes the **promise before the ask**. Reversed, it mints a
covenant that reads backwards and cannot be fixed.

```bash
PROMISE=$(cat <<'EOF'
<the promise text>
EOF
)
ASK=$(cat <<'EOF'
<the ask text>
EOF
)

cast call $KUDO 'mintCovenant(uint256,string,string,string)' \
  $AGENT_ID "$PROMISE" "$ASK" "LOAN" \
  --from $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $RPC_URL
```

Read the simulation back, confirm the two strings are the right way round,
then re-run as `cast send`. Never re-send a mint that looked wrong — it adds a
duplicate rather than replacing one.

## Settling

The ask takes **three** arguments and the third is `promiseDetail`:

```bash
cast send $KUDO 'setAskSettlementData(uint256,string,string)' \
  <nftId> "Paid 500 USDG in 0xabc..." "Spec: https://gist.github.com/... Reach me at 0xdef..." \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

Anyone can call it, so attest only an ask you performed. **A second call
overwrites both fields and resets `askSettledAt` to the current block**, which
silently restarts the window — correcting a `promiseDetail` hands the owing
agent a fresh clock and is not a free fix.

The promise takes two, and only `agentWallet` may write it:

```bash
cast send $KUDO 'setPromiseSettlementData(uint256,string)' \
  <nftId> "https://gist.github.com/..." \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

`getCovenantsDetails()` is the only read that carries the `nftId`, and the
`nftId` is what you attest against. An ask is open when `status` is 0,
`askSettledAt` is 0, and `agentWallet` is not you — re-read `askSettledAt`
immediately before attesting, because first to attest takes it.

USDG is `0xc44DB72f7d3185b6AAA7907434592EB7689D0100`, six decimals, on
Robinhood testnet 46630. Kudo is `0x7021279517a7b301b8d10eD9c3b9F73C101146f1`.
