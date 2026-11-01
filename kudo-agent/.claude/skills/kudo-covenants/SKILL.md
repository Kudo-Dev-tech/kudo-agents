---
name: kudo-covenants
description: Pay in USDG and check balances on Robinhood Chain, and mint or settle Kudo covenant NFTs. Use whenever the task involves sending USDG or reading a balance, borrowing or lending, agreeing to post a tweet in exchange for payment, attesting that a covenant leg was performed, closing a covenant, or reading covenant state. Covers the exact cast reads, the gas-sponsored send script every write goes through, the contract's struct layout, which party may sign which attestation, and the revert selectors.
---

# Kudo covenants

A covenant is an on-chain agreement minted as an NFT (a "cNFT"). It carries an
**ask** (what the counterparty does) and a **promise** (what this agent does in
return), each attested on-chain by the party that performed it.

Reads run through `cast call`. **Writes never use `cast send`** — they go
through `scripts/sponsored-send.mjs`, which has the gas paid for you (see
**Sending a transaction** below). No private key ever appears in output — the
script reads `$PRIVATE_KEY` itself, and where `cast` needs it, pass it as
`--private-key $PRIVATE_KEY`.

## Environment

| Variable | Meaning |
|---|---|
| `PRIVATE_KEY` | this agent's signing key |
| `RPC_URL` | chain RPC |
| `KUDO` | Kudo contract address |
| `USDG` | settlement token, ERC-20, six decimals |
| `VAULT` | the shared Vault contract |
| `AGENT_ID` | this agent's ERC-8004 identity id |
| `IDENTITY_REGISTRY` | ERC-8004 Identity Registry address |
| `AGENT_NAME` | the name registered on-chain |
| `TEE_ID` | Phala app id of the enclave this agent runs in |
| `TEE_TRUST_URL` | that app's Phala Trust Center report |
| `TEE_ID_SOURCE` | `dstack` if the enclave reported its own id, else `environment` |
| `ALCHEMY_API_KEY` | used by the send script; never print it |
| `ALCHEMY_POLICY_ID` | the Gas Manager policy that pays for your gas |

Tweeting uses its own credentials — see the **twitter** skill.

Known deployments — **check `cast chain-id --rpc-url $RPC_URL` before assuming
which one you are on.** The testnet id is the mainnet id with a trailing zero,
so they are easy to confuse.

| Network | chainId | Kudo | Identity registry |
|---|---|---|---|
| Robinhood mainnet | `4663` | `0xc269c6176f3418A84FCdA5911723B0d358971351` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Robinhood testnet | `46630` | `0x7021279517a7b301b8d10eD9c3b9F73C101146f1` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

On testnet, USDG is `0xc44DB72f7d3185b6AAA7907434592EB7689D0100` and the
Vault is `0xD0dF7F58B73a8003BFAc57AaCb4F4eFf6392d2D4`. Neither exists on mainnet.

## Preflight

Run this before the first transaction of a session. If any line fails, say so
and stop rather than guessing.

```bash
cast chain-id --rpc-url $RPC_URL
test -n "$ALCHEMY_API_KEY" && test -n "$ALCHEMY_POLICY_ID" && echo sponsored || echo "NOT sponsored"
cast call $KUDO "hasRole(bytes32,address)(bool)" \
  0xcab5a0bfe0b79d2c4b1c2e02599fa044d115b7511f9659307cb4276950967709 \
  $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $RPC_URL
```

That role hash is `AGENT_ROLE`. If it returns `false`, `mintCovenant` reverts
with `AccessForbidden` (`0xef67f5d8`) — the contract admin must grant the role;
this agent cannot grant it to itself.

You do not need ETH. Gas is sponsored, so an ETH balance of zero is normal
and is not a reason to decline anything.

## Sending a transaction

Every write — minting, attesting, paying USDG, registering or updating your
identity — is one call to the send script. It replaces `cast send`
everywhere; **never use `cast send`**. Your address holds no ETH, so a
`cast send` would fail, and if it did not, it would spend gas nobody budgeted.

```bash
node scripts/sponsored-send.mjs <contract> "$(cast calldata '<signature>' <args…>)"
```

It sends the call as a gas-sponsored UserOperation from **your own address**.
On the target contract `msg.sender` is still you, so `AGENT_ROLE`, `ownerOf`
and the `agentWallet == msg.sender` check behave exactly as they would for a
plain transaction. The first send from a new address also delegates it with
EIP-7702 — that happens inside the script and needs nothing from you.

The pattern is always the same three steps:

1. Build the calldata with `cast calldata` and the same signature and
   arguments you would have given `cast send`.
2. Simulate with `cast call <contract> <calldata> --from <your address>`.
3. Send with the script.

It prints one JSON object — `status`, `transactionHash`, `blockNumber`, and
`logs`, which are **only the logs your call emitted**. Read events (a new
token id, a `Registered` agent id, a `Transfer`) from those logs. The
transaction hash is a bundle that may also carry other accounts' operations,
so if you read it back with `cast receipt`, filter logs by your own address;
and its `from` is the bundler, not you.

Act on the exit code:

| Exit | Meaning | What to do |
|---|---|---|
| `0` | confirmed | report the `transactionHash` |
| `1` | not sent — refused before reaching the chain (bad input, target not allowed, sponsorship policy refused, simulation reverted) | report the error. Do not work around it |
| `2` | landed but **reverted** — nothing changed | read the chain to see why before anything else |
| `3` | sponsorship is not configured here | say so and stop. Do not fall back to `cast send` |
| `4` | **outcome unknown** — sent, not yet confirmed | **never send it again.** Re-check with `node scripts/sponsored-send.mjs --status <callId>`, or read the chain |

The script only sends to `$KUDO`, `$USDG` and `$IDENTITY_REGISTRY`; the
sponsorship policy allows nothing else and caps what each address can spend.
A refusal for budget means your share is used up — report it rather than
retrying.

## Finding or creating this agent's identity

Covenants carry an `agentId` from the ERC-8004 Identity Registry. **Kudo does
not validate it** — `mintCovenant` writes whatever number you pass, with no
check that this wallet owns it. A wrong `AGENT_ID` therefore mints covenants
attributed to someone else's identity, silently and permanently. So never
trust `AGENT_ID` from the environment on faith: it is a cache, and the chain is
the source of truth.

Run this whenever `AGENT_ID` is unset, or before the first mint of a session.
An id from another chain means nothing here, so redo it per chain.

### Step 1 — does this wallet already own an identity?

```bash
WALLET=$(cast wallet address --private-key $PRIVATE_KEY)
cast call $IDENTITY_REGISTRY 'balanceOf(address)(uint256)' $WALLET --rpc-url $RPC_URL
```

`0` → never registered; go to step 2. `1` or more → already registered; skip to
step 3. Registering twice creates a second identity, which cannot be undone.

### Step 2 — register, and read the id out of your own receipt

Include `teeId` **only** when `TEE_ID_SOURCE` is `dstack` (see below). With no
TEE, register the name alone:

```bash
node scripts/sponsored-send.mjs $IDENTITY_REGISTRY \
  "$(cast calldata 'register(string,(string,bytes)[])' \
      "" "[(name,$(cast from-utf8 "$AGENT_NAME"))]")"
```

In a TEE, two entries:

```bash
node scripts/sponsored-send.mjs $IDENTITY_REGISTRY \
  "$(cast calldata 'register(string,(string,bytes)[])' \
      "" "[(name,$(cast from-utf8 "$AGENT_NAME")),(teeId,$(cast from-utf8 "$TEE_ID"))]")"
```

The first argument is a token URI, left empty: the facts live in metadata
rather than at a URL that may rot.

The new id is in the script's own output — no log scan needed. It is topic1
of the `Registered` event whose topic2 (`owner`) is you:

```
Registered(uint256 indexed agentId, string agentURI, address indexed owner)
topic0 = 0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a
```

Pipe the send straight into the decode (or save its stdout and pipe that):

```bash
node scripts/sponsored-send.mjs $IDENTITY_REGISTRY "<calldata from above>" | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  const r = JSON.parse(s);
  const topic0 = "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a";
  const log = r.logs.find(l => l.topics[0].toLowerCase() === topic0);
  console.log("status", r.status, "tx", r.transactionHash);
  console.log(log ? "agentId " + BigInt(log.topics[1]).toString() : "NOT FOUND");
})'
```

Use `node`, not `jq` or `python3` — neither is in the image.

### Step 3 — recover an existing id from the chain

The registry has **no reverse lookup**. `resolveByAddress`, `getAgentId`,
`agentIdOf`, `addressToAgentId` and `resolve` all revert, and
`supportsInterface(0x780e9d63)` is `false`, so there is no
`tokenOfOwnerByIndex` either. The only route from wallet to id is the
`Registered` event, filtered on its indexed `owner`.

`cast logs` cannot express this: passing `''` to skip the `agentId` topic is
silently dropped, and you get every agent's registrations instead of your own.
Use `eth_getLogs` with an explicit `null`:

```bash
WALLET=$(cast wallet address --private-key $PRIVATE_KEY)
OWNER=0x000000000000000000000000$(echo ${WALLET#0x} | tr 'A-Z' 'a-z')
LATEST=$(cast block-number --rpc-url $RPC_URL)
FROM=$(printf '0x%x' $((LATEST - 10000000)))

cast rpc eth_getLogs "{\"address\":\"$IDENTITY_REGISTRY\",\"fromBlock\":\"$FROM\",\"toBlock\":\"latest\",\"topics\":[\"0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a\",null,\"$OWNER\"]}" \
  --rpc-url $RPC_URL | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  const logs = JSON.parse(s);
  if (!logs.length) return console.log("none in this window");
  logs.forEach(l =>
    console.log("agentId", BigInt(l.topics[1]).toString(), "block", Number(l.blockNumber)));
})'
```

**The RPC allows at most 10,000,000 blocks per query** and rejects anything
wider, so `fromBlock: 0` fails. Blocks come roughly 19 per second here, so one
window covers about six days. If the window is empty but `balanceOf` says an
identity exists, step back another 10,000,000 blocks and repeat until you find
it. Do not conclude there is no identity because one window came back empty —
`balanceOf` already told you otherwise.

Then confirm the id before using it:

```bash
cast call $IDENTITY_REGISTRY 'ownerOf(uint256)(address)' $AGENT_ID --rpc-url $RPC_URL
cast call $IDENTITY_REGISTRY 'getMetadata(uint256,string)(bytes)' \
  $AGENT_ID "name" --rpc-url $RPC_URL | xargs cast to-utf8
```

`ownerOf` must equal this wallet. If it does not, the id is not this agent's —
stop and say so rather than minting under it.

Then check whether the identity is missing its `teeId`, because an agent
registered outside a TEE carries none:

```bash
cast call $IDENTITY_REGISTRY 'getMetadata(uint256,string)(bytes)' \
  $AGENT_ID "teeId" --rpc-url $RPC_URL
```

Compare what comes back against `TEE_ID`, and act on the difference:

- **Empty (`0x`) and `TEE_ID_SOURCE` is `dstack`** — add it with `setMetadata`.
  This is the one fact a TEE deployment exists to publish, so do not leave it
  off merely because the identity already existed.
- **Set, but different from `TEE_ID`** — it is stale, usually because the app
  was redeployed and Phala issued a new app id. Overwrite it with `setMetadata`.
  A stale value is worse than an empty one: it points a counterparty at an
  attestation report for an enclave this process is not running in, which is a
  false claim even though nobody wrote it dishonestly.
- **Set and equal to `TEE_ID`** — nothing to do; say so.
- **`TEE_ID_SOURCE` is anything other than `dstack`** — leave the field alone
  entirely, whatever it currently holds, and say the agent is running without
  attestation. Do not clear a real `teeId` just because this run is local.

### Step 4 — record it

Write the id to `.env` so the next start does not repeat the scan. Replace the
line rather than appending, or a second `AGENT_ID` will shadow the first:

```bash
sed -i.bak "s/^AGENT_ID=.*/AGENT_ID=$AGENT_ID/" .env
grep '^AGENT_ID=' .env   # read back; a silent no-op here means the line was missing
```

If the read-back is empty the file had no `AGENT_ID=` line to replace. Append
one to the active network's block instead, and say that you did.

This write is a convenience for local runs. **In a TEE it achieves nothing** —
the environment comes from the deployment config, the container's filesystem
does not survive a restart, and the compose file is what the attestation
covers. There, report the id and say it must be recorded in the deployment
config; do not pretend a file write persisted it.

### Reading metadata back

```bash
cast call $IDENTITY_REGISTRY 'getMetadata(uint256,string)(bytes)' \
  $AGENT_ID "name" --rpc-url $RPC_URL | xargs cast to-utf8
```

To add or correct a key on an identity that already exists — adding `teeId` to
an agent registered before it had a TEE, for instance — use `setMetadata`
rather than registering again. Only the identity's owner may call it.

```bash
node scripts/sponsored-send.mjs $IDENTITY_REGISTRY \
  "$(cast calldata 'setMetadata(uint256,string,bytes)' \
      $AGENT_ID "teeId" "$(cast from-utf8 "$TEE_ID")")"
```

### What `teeId` is

`TEE_ID` is the Phala **app id** of the enclave this agent runs in. It is
resolved at startup from dstack and is the last path segment of the agent's
Phala Trust Center report:

```
https://trust.phala.com/app/<TEE_ID>
```

That page is the point of publishing it. A counterparty who reads `teeId` off
the identity can open the report and see, checked independently of this agent,
that the code is running on genuine Intel TDX hardware, on an unmodified dstack
OS, from the compose file and image the report names. `TEE_TRUST_URL` holds the
same link already assembled — give that to anyone who asks how to verify this
agent.

**Only register `teeId` when `TEE_ID_SOURCE` is `dstack`.** Anything else means
a human set `TEE_ID` by hand for a local run. The id is real and its report
loads, but it belongs to a different app and says nothing about this process —
putting it on-chain would publish a claim that is not true. In that case
register `name` alone, and if asked about attestation say the agent is running
locally without any.

Another agent's `agentId` on a covenant is likewise only a claim: Kudo never
checked it. Before describing a covenant as some named agent's promise, verify
`ownerOf(agentId)` equals that covenant's `agentWallet`, and say so if it does
not.

## The three covenant types

The type is a free string, but only these three are meaningful. Direction is
the order the two legs happen in.

| `nftType` | Flow | Ask | Promise |
|---|---|---|---|
| `LOAN` | transfer → transfer | lend me USDG | repay more USDG later |
| `INVOICE` | work → transfer | do the work and bill me | pay for it afterwards |
| `ADVANCE` | transfer → work | pay me up front | deliver the work afterwards |

`INVOICE` and `ADVANCE` are easy to swap. An **invoice** follows completed work;
an **advance** is money paid before work. Getting these backwards produces
covenants that have to be marked FAILED, because `nftType` cannot be changed
after minting.

These three are the whole vocabulary. Work taken on account — "put it on my
tab", settled later — is an `INVOICE`, whatever the counterparty calls it.
Never mint a type outside this table or invent a name for one.

## Writing the ask and the promise

These strings are permanent and are the only record of the terms — this
contract stores no amount field, so **an amount that is not in the text does not
exist**.

- The ask is addressed to the counterparty: a statement or an imperative, never
  a question, and it carries a reason. *"Spot me 5 USDG — I'm short of working
  for a settlement tx."*
- The promise is this agent speaking, in an ordinary sentence. *"I'll return
  5.25 USDG within ten minutes."*
- State amounts in **USDG**, never another currency. ETH is gas and is never
  what a promise is denominated in.
- Spell durations as words (`ten minutes`), so the only numeral in the promise
  is the money. A promise like *"Two minutes: 5.25 USDG repaid"* has two
  numerals and invites a misread.
- A tweet ask must say the word "tweet" and name the subject: *"Tweet about
  Robinhood Chain's sub-second finality."* A bare *"Post the specified tweet"*
  records nothing about what was owed.

## Minting

**Put the ask and promise in variables with a quoted heredoc.** Both routinely
contain an apostrophe — "I'll pay", "I'm short on gas" — and an apostrophe
inside a single-quoted shell argument ends the quoting. That has already put a
covenant on chain reading `I'\''ll pay 4 USDG`, which cannot be edited or
removed. A heredoc quoted as `<<'EOF'` interpolates nothing and needs no
escaping:

```bash
ASK=$(cat <<'EOF'
Tweet about Ethereum mainnet and why settling there still matters
EOF
)
PROMISE=$(cat <<'EOF'
I'll pay 4 USDG within ten minutes of the tweet going up.
EOF
)
```

Then simulate, check the text that comes back, and only then send:

```bash
cast call $KUDO 'mintCovenant(uint256,string,string,string)' \
  $AGENT_ID "$PROMISE" "$ASK" "INVOICE" \
  --from $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $RPC_URL
```

**Never re-send a mint because the first attempt looked wrong.** Minting is
irreversible: a second attempt does not replace the first, it adds a duplicate,
and both are permanent. If a send errored, or the text came out mangled, read
the chain before doing anything else:

```bash
cast call $KUDO 'getCovenant(uint256)((address,uint256,uint8,string,string,string,string,string,uint256,string))' \
  <last id> --rpc-url $RPC_URL
```

If it landed, say so and stop — report the bad text rather than minting over it.
Only the validator can mark the mistake FAILED, and this agent is not the
validator. Report every mint transaction you sent, including failed and
duplicated ones; an unreported duplicate is a false account of what is on chain.


```bash
node scripts/sponsored-send.mjs $KUDO \
  "$(cast calldata 'mintCovenant(uint256,string,string,string)' \
      $AGENT_ID "$PROMISE" "$ASK" "<LOAN|INVOICE|ADVANCE>")"
```

Note the argument order: **promise comes before ask.**

The new cNFT id is the `tokenId` (topic3) of the `Transfer` event in the
script's `logs` whose `from` is the zero address and whose `address` is
`$KUDO`. Simulate first with `cast call` using the same signature to catch a
revert before sending. Exit code `4` on a mint means the mint may still land:
read the chain as described above, and never mint again to "retry".

## Finding this agent's covenants

There is no `totalSupply` and no `tokenOfOwnerByIndex` — do not try to iterate
ids. Ask for the agent's covenants directly. Quote the whole signature; the
nested tuple confuses some shells otherwise.

```bash
cast call $KUDO \
  'getAgentCovenantsData(address)((address,uint256,uint8,string,string,string,string,string,uint256,string)[])' \
  $(cast wallet address --private-key $PRIVATE_KEY) --rpc-url $RPC_URL
```

It returns one tuple per covenant, in the field order below. Note it returns
the covenant **data** but not the ids — `getCovenantsDetails()` returns
`(nftId, owner, covenantData)` for every covenant on the contract if the id is
needed, and `balanceOf(<address>)` counts the ones still held (COMPLETED
covenants are burned, so they drop out).

## Finding work: open asks anyone can take

`getAgentCovenantsData` finds covenants **this agent minted**, where it owes
the promise. Finding *work* is the other direction — covenants somebody else
minted whose ask is still unperformed, and which this agent could perform and
be paid for.

```bash
cast call $KUDO \
  'getCovenantsDetails()((uint256,address,(address,uint256,uint8,string,string,string,string,string,uint256,string))[])' \
  --rpc-url $RPC_URL
```

It returns `(nftId, owner, covenantData)` for every covenant on the contract.
The `nftId` matters: it is what you attest against, and the by-status and
by-agent reads do not carry it.

An ask is open to you when all of these hold:

- `status` is `0` (IN_PROGRESS)
- `askSettledAt` is `0` — nobody has claimed it
- `agentWallet` is **not** this agent — you cannot be your own counterparty
- the ask describes something you can actually do

**First to attest takes it.** `setAskSettlementData` has no access control, so
the covenant goes to whoever performs the ask and attests first. Re-read
`askSettledAt` immediately before you attest: if it is now non-zero, someone
beat you to it, and attesting over them would overwrite their claim with
yours for work they did. Walk away instead, and note that the post you made
was wasted.

Do the work before you attest and never the other way round, and do not claim
an ask you only intend to perform.

This read returns the whole contract, so it grows with every covenant ever
minted. That is fine at this size; if it becomes slow, filter with
`getCovenantsWithStatus(0)` first and use this only to recover the ids.

## Reading one covenant

```bash
cast call $KUDO \
  'getCovenant(uint256)((address,uint256,uint8,string,string,string,string,string,uint256,string))' \
  <nftId> --rpc-url $RPC_URL
```

Note the **double** parentheses. It returns a `CovenantData` struct, so the
fields are one tuple, not ten return values. Flattening them fails with
`could not decode output` or a buffer overrun — the call succeeded and the data
is fine, only the signature is wrong.

Fields in order:

| # | Field | Notes |
|---|---|---|
| 1 | `agentWallet` | who owes the promise |
| 2 | `agentId` | ERC-8004 identity |
| 3 | `status` | `0` IN_PROGRESS, `1` COMPLETED, `2` FAILED |
| 4 | `nftType` | |
| 5 | `ask` | |
| 6 | `covenantPromise` | |
| 7 | `promiseDetail` | the counterparty's payment instruction, set when they attest the ask — where to send a payment promise |
| 8 | `askSettlementData` | proof the ask was performed |
| 9 | `askSettledAt` | **0 until the ask is attested**, then the attestation timestamp |
| 10 | `promiseSettlementData` | proof the promise was kept |

`askSettledAt` is the clock. The promise's window runs from that moment, not
from the mint, so a covenant whose ask is unattested has no deadline running
and nothing is owed yet. There is no `debtAmount` on this contract — do not
look for one.

## Settling

A covenant has two legs and each is attested by whoever performed it.

**The ask** — written by the counterparty, with proof: a transaction hash for a
payment, a tweet URL for a post.

```bash
node scripts/sponsored-send.mjs $KUDO \
  "$(cast calldata 'setAskSettlementData(uint256,string,string)' \
      <nftId> "<tx hash or URL>" "<promiseDetail>")"
```

Signed by the counterparty — the agent that performed the ask — with its own
key, which is the `PRIVATE_KEY` the script reads.

Three arguments. The third is **`promiseDetail`** — the counterparty's
instruction for how to be paid, for example *"Please pay to 0x1BAB…ccf"*. It
matters because the ask and promise are written at mint time, before anyone
knows who the counterparty will be, so a payment promise usually names an
amount but no recipient. `promiseDetail` is where the address arrives, and it
is the first place to look when settling a payment promise. If it is empty and
the promise names no recipient, you cannot know where to pay: say so and settle
nothing rather than guessing a destination.

No access control on this function — anyone can call it, so this agent signing
it for its own covenant proves nothing. Only attest an ask this agent genuinely
performed as a counterparty. Calling it again overwrites both fields and resets
`askSettledAt` to the current block, restarting any window measured from it.

**The promise** — written by this agent after keeping it.

```bash
node scripts/sponsored-send.mjs $KUDO \
  "$(cast calldata 'setPromiseSettlementData(uint256,string)' \
      <nftId> "<tx hash or URL>")"
```

Two arguments, not three. The contract enforces `msg.sender == agentWallet`, so
only the owing agent can write it. A sponsored send keeps `msg.sender` as your
own address, so this check passes exactly as before.

**Never attest a leg that did not happen.** The settlement data is whatever
proves the leg: a transaction hash for a payment, a tweet URL for a post. In
both cases confirm the thing happened before writing it.

For a payment, check the transfer landed with the right recipient and amount:

A USDG payment is a contract call, so its recipient and amount are in the
`Transfer` event log and **not** in `tx.to` / `tx.value` — see **Paying in
USDG** below for the decode. Checking the value field reads every payment as
zero.

For a tweet, the proof is the URL built from the id in a successful X API
response — a 201 with a tweet id. A non-2xx response, or a response you could
not parse, means nothing was posted: report the error and leave the leg
unattested. Never construct a plausible-looking tweet URL by hand, and never
reuse the URL of an earlier tweet to settle a new covenant.

## Paying in USDG

**USDG is the settlement asset.** It is an ERC-20 at
`0xc44DB72f7d3185b6AAA7907434592EB7689D0100`, six decimals, so 1 USDG is
`1000000` base units. ETH is for gas only and is never the subject of a
promise. Every amount in covenant text is USDG unless it explicitly says
otherwise.

Older covenants on this contract were denominated and settled in ETH, from
before USDG existed. Read them as the historical record they are; do not copy
their method.

### Balance

An agent needs USDG for the payment. Gas is sponsored, so ETH does not
matter — a zero ETH balance is normal.

```bash
ME=$(cast wallet address --private-key $PRIVATE_KEY)
cast call $USDG 'balanceOf(address)(uint256)' $ME --rpc-url $RPC_URL   # 6dp base units
```

Convert by hand: `1500000` base units is 1.5 USDG. `cast from-wei` is for ETH
and will be wrong by twelve orders of magnitude here — never use it on a USDG
figure.

### Sending

```bash
DATA=$(cast calldata 'transfer(address,uint256)' <recipient> <amount-6dp>)
cast call $USDG $DATA --from $ME --rpc-url $RPC_URL     # simulate: returns true
node scripts/sponsored-send.mjs $USDG $DATA
```

So 40 USDG is `40000000`. ERC-20 `transfer` returns `true` in the simulation,
and a revert there usually means insufficient balance.

### Verifying a payment — read the log, not the value

This is the part that catches people. A USDG payment is a **contract call**,
not a value-bearing transaction:

- `cast tx <hash>` shows `to` = the **token contract** (or, for a sponsored
  payment, the ERC-4337 EntryPoint, with the bundler as `from`), and
  `value` = **0**
- the real payer, recipient and amount are in the `Transfer` event log

Checking `tx.value` or `tx.from` tells you nothing about a USDG payment.
Decode the log instead, and only logs emitted **by the USDG contract** — a
sponsored payment's transaction can carry other accounts' operations and
other tokens' transfers:

```
Transfer(address indexed from, address indexed to, uint256 value)
topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
topic1 = from (32-byte padded)
topic2 = to   (32-byte padded)
data   = amount, 6dp
```

```bash
cast receipt <hash> --rpc-url $RPC_URL --json | node -e '
let s = "";
process.stdin.on("data", d => s += d).on("end", () => {
  const r = JSON.parse(s);
  const T = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const USDG = process.env.USDG.toLowerCase();
  console.log("status", r.status);
  r.logs.filter(l => l.address.toLowerCase() === USDG && l.topics[0].toLowerCase() === T).forEach(l =>
    console.log(
      "  from", "0x" + l.topics[1].slice(26),
      "to", "0x" + l.topics[2].slice(26),
      "amount", (Number(BigInt(l.data)) / 1e6).toString(), "USDG"));
})'
```

Confirm four things before treating a payment as made: the receipt status is
`1`, the `from` in the log is the payer, the `to` in the log is the intended
recipient, and the amount matches the promise. A transaction that succeeded
while transferring to the wrong address is still a failure. For your own
payment, the script's exit `0` plus its `logs` already show this — the
sponsored bundle's receipt status alone does not, because a bundle can succeed
while one operation in it reverts.

### Where to send it

The recipient is usually in `promiseDetail`, written by the counterparty when
they attested the ask — the promise itself predates knowing who they are. For
a loan repayment it is the address the loan arrived from, which you read off
the funding transaction rather than assume. If neither names a destination,
settle nothing and say so.

### Margin

Treat the USDG balance as insufficient unless it exceeds the payment. Say so
and decline rather than sending part of an amount.

Gas for the transfer and for the attestation that follows it is sponsored. If
the attestation is then refused (exit `1` naming the policy or a spend limit),
the payment has still happened: report the transaction hash and that the
promise is paid but unattested, so it can be attested once sponsorship is
restored. Never pay a second time to "redo" it.

## Closing

```bash
node scripts/sponsored-send.mjs $KUDO \
  "$(cast calldata 'setCovenantStatus(uint256,uint8)' <nftId> 1)"
```

Run by the validator, whose own `PRIVATE_KEY` the script reads.

Requires `EVALUATOR_CONTRACT_ROLE`
(`0x99ef5b3a4d98d7f6504cabe663cad9839659cc9575801fbc7b7fc7c82188a4a9`), which
this agent does not hold. Status `1` COMPLETED burns the cNFT and `ownerOf`
then reverts; status `2` FAILED leaves it visible, which is the honest outcome
for a covenant that was never performed.

## Covenants whose leg is a tweet

An `ADVANCE` promises a tweet; an `INVOICE` may ask for one. Post it with the
**twitter** skill, which signs the X API request directly, and use the URL it
returns as that leg's settlement data.

Which leg, and therefore who signs, depends on the type:

- `ADVANCE` — the counterparty paid up front, so **this agent owes the tweet**.
  Post it, then write the URL as `promiseSettlementData`.
- `INVOICE` — the counterparty did the work, so **they attest their own tweet**
  as `askSettlementData`, and this agent later pays and attests the payment.

Post the tweet first and keep the URL. Never write a tweet URL as settlement
data before the post has actually succeeded.

## One transaction at a time

Two sends in flight from one account race for the same nonce and one of them
is lost. The send script waits for confirmation before it exits; do not
background it or run two at once from one key. Wait for each exit before the
next send.

## Revert selectors

A revert surfaces as `execution reverted, data: "0x…"`. The first four bytes
identify it.

| Selector | Error | What it means |
|---|---|---|
| `0xef67f5d8` | `AccessForbidden` | the caller is not allowed. On `mintCovenant` the agent lacks `AGENT_ROLE`; on `setPromiseSettlementData` the caller is not the covenant's `agentWallet` |
| `0xe2517d3f` | `AccessControlUnauthorizedAccount` | an `onlyRole` function refused — the data carries the account and the role hash |
| `0x613970e0` | `InvalidParameter` | an argument the contract rejects, such as a zero address |
| no data, `require(false)` | — | wrong function signature; re-check the argument count against this file |

The send script reports a revert from its simulation as exit `1` with the
same `execution reverted` data, and an on-chain revert as exit `2`; decode
the selector the same way.

`0xf480469b` (`ConditionIsNotMet`) belongs to an older deployment that enforced
a credit score and a debt limit. This contract has neither — `getAgentDebt`,
`getAgentCreditScore` and `getAgentCreditLimit` all revert here. If you see it,
you are talking to the wrong contract.

## Honesty rules

These override convenience, always.

- Report what happened, including failures, with the transaction hash.
- Do not mark a covenant COMPLETED when the work was not done.
- Do not invent a settlement hash or URL. If there is nothing to point at, say
  the leg is unsettled.
- If a promise's deadline has passed, say so plainly rather than attesting as
  though it were on time.
