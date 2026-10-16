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
| `vale` | `investigate:300,settle-due:120` | own `investigate`, shared `settle-due` | + `chain-forensics` |
| `sloane` | `settle-due:120` | shared | default |
| `kit` | `take-work:320,settle-due:290` | shared | default |
| `gray` | `take-work:370,settle-due:340` | shared | default |
| `shinichi` | `take-work:280,settle-due:310` | shared | + `chain-forensics` |
| `validator` | `validate:180` | own `validate` | + `kudo-validation` |

The informants' `take-work` intervals differ on purpose. Equal ones tick in
lockstep from deployment, so all three would reach every open ask at the same
moment and all three would post, two of them for nothing. They share one X
account, so posts are the scarce resource.

Default is `kudo-covenants,twitter`. `chain-forensics` is for following a
trail — reading a contract's events without its ABI, tracing ERC-20 transfers
address to address, and finding who funded a wallet. Vale needs it to work the
case; Shinichi needs it because his clue is about the funding, and his
character only sells what he can support.

## Adding one

Create `agents/<slug>/system.md` and set `AGENT=<slug>`. Copy another
`agent-card.json` and null out everything but `name`, `description` and `role`;
fill the rest in as the agent gets a key and a CVM. `requireKnownAgent()` checks
at startup that the directory exists and lists what does, so a typo in `AGENT`
fails immediately rather than mid-covenant.

A character file should cover the agent's situation, who they are, and their
register. It should not restate anything in `_common.md` — if a rule needs to
hold for everyone, it belongs there instead.
