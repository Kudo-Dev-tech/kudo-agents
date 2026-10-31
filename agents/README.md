# agents/

One directory per agent. **The directory name is the value of `AGENT`.**

```
_common.md              every agent reads this first: the covenant model, the
                        honesty rules, how to work at the shell
<slug>/system.md        who that one agent is, and nothing else
<slug>/agent-card.json  its public identity: name, role, address, teeId,
                        attestation, endpoint
<slug>/prompts/*.txt    task prompts only that agent runs
<slug>/.env             its key, identity, jobs and skills (gitignored)
```

Nothing here is code. Every character ships in one image, and `AGENT` picks
which one at runtime.

Every agent carries an `agent-card.json` on the same schema — the
human-readable copy of what it registers as ERC-8004 metadata. Fields it has
not earned yet are `null` rather than absent: an agent with no `teeId` has not
been deployed to a CVM, and one with no `address` has no key on chain. Reading
down the column is how you see what is actually live.

Task prompts are looked up in the agent's own directory first, then in the
shared `../prompts/`. A prompt that only one agent should ever run lives only
in that agent's directory, so another agent configured to run it fails at its
first tick — `validate` is the Validator's, because he alone holds the
evaluator role. Prompts several agents share stay in `../prompts/`, for the
same reason the rules live in one `_common.md`: a second copy is a copy that
drifts.

`src/agent/prompts.ts` concatenates `_common.md` and `<AGENT>/system.md`, in
that order, into the system prompt. Nothing else about the image changes
between agents.

That is deliberate. Every CVM runs the same image pinned by the same digest, so
`AGENT` is the only thing that makes one of them Vale. The shared rules cannot
drift apart between agents because there is only one copy of them, and the
attestation covers every character at once.

Who each agent is, in one line each, is in the
[root README](../README.md#the-agents) — one copy, for the same reason as
everything else here.

## Who runs what

| `AGENT` | `JOBS` | prompts | `SKILLS` |
| --- | --- | --- | --- |
| `analyst` | `take-work:90,settle-due:180` | shared | + `chain-forensics`, `github-gists` |
| `trader` | `settle-due:120` | shared | + `chain-forensics` |
| `market` | `settle-due:130` | shared | + `github-gists` |
| `business` | `settle-due:170` | shared | + `chain-forensics`, `github-gists` |
| `tokenomics` | `settle-due:190` | shared | + `chain-forensics`, `github-gists` |
| `synthesizer` | `settle-due:230` | shared | + `github-gists` |
| `lender` | `take-work:100,settle-due:140` | shared | default |
| `developer` | `take-work:110,settle-due:160` | shared | + `github-gists` |
| `validator` | `validate:180` | own `validate` | + `kudo-validation` |

Only two agents perform other agents' asks, so only two run `take-work`. The
analyst performs four — three research asks and the synthesis — plus the
trader's; the lender performs the analyst's loan ask. Everybody else in the
chain mints one covenant and owes one promise, so `settle-due` is their whole
schedule.

The `settle-due` intervals are pairwise non-multiples on purpose. Equal ones
tick in lockstep from deployment, so every agent whose promise is a post would
reach the X API in the same instant. There is one X account between the whole
cast, which makes posts the scarce resource and the rate limit the likeliest
thing to stop a run.

The analyst is the only agent holding both ends of the chain at once, and
[docs/research-chain.md](../docs/research-chain.md) calls for a prompt of its
own. Until that exists it runs the shared pair, which covers both halves of its
work but does not sequence them.

Default is `kudo-covenants,twitter`. `chain-forensics` is for following a
trail — reading a contract's events without its ABI, tracing ERC-20 transfers
address to address, and finding who funded a wallet. The four that have it are
the ones whose work is provenance: the tokenomics report derives emission from
the transfer log, the business report has to find who funded the deployer, the
analyst spot-checks what it is about to pay for, and the trader checks the
figures it is paying 100 USDG for.

`github-gists` goes to the five agents that publish: the three researchers, the
synthesizer and the analyst. A report is too long for a post, so it is
published as a public gist and the covenant is settled with the gist's raw
revision URL — bytes that cannot change after the validator has read them. The
trader and the lender never publish, and giving them the skill would tell them
publishing is work they do. It needs `GITHUB_TOKEN` in the shared `.env`;
startup warns when an agent has the skill and no token, rather than letting a
run get as far as having a report and nowhere to put it.

The validator needs no skill for this. Reading a public gist is an
unauthenticated GET, and what it has to know — fetch the raw revision URL, not
the gist's own — is in `kudo-validation` with the rest of its evidence rules.

`developer` publishes too, but what it publishes is source rather than
research, and its deliverable is the artefact plus the evidence it runs: a
testnet address, a passing test, a call returning what it should. Note that the
image ships `cast` and not `forge`, so it cannot compile a contract inside a
CVM — its character tells it to say so and stop rather than fetch a toolchain
at runtime. Driven locally, where `forge` exists, it works today.

## Adding one

Create `agents/<slug>/system.md` and set `AGENT=<slug>`. Copy another
`agent-card.json` and null out everything but `name`, `description` and `role`;
fill the rest in as the agent gets a key and a CVM. `requireKnownAgent()` checks
at startup that the directory exists and lists what does, so a typo in `AGENT`
fails immediately rather than mid-covenant.

A character file should cover the agent's situation, who they are, and their
register. It should not restate anything in `_common.md` — if a rule needs to
hold for everyone, it belongs there instead.
