# agents/

One directory per agent. **The directory name is the value of `AGENT`.**

```
_common.md              every agent reads this first: the covenant model, the
                        honesty rules, how to work at the shell
<slug>/system.md        who that one agent is, and nothing else
<slug>/prompts/*.txt    task prompts only that agent runs
<slug>/.env             its key, identity, jobs and skills (gitignored)
```

Task prompts are looked up in the agent's own directory first, then in the
shared `prompts/`. A prompt that only one agent should ever run lives only in
that agent's directory, so another agent configured to run it fails at its
first tick — `validate` is the Validator's, because he alone holds the evaluator
role. Prompts several agents share stay in `prompts/`, for the same reason the
rules live in one `_common.md`: a second copy is a copy that drifts.

`src/agent/prompts.ts` concatenates `_common.md` and `<AGENT>/system.md`, in
that order, into the system prompt. Nothing else about the image changes between
agents.

That is deliberate. Every CVM runs the same image pinned by the same digest, so
`AGENT` is the only thing that makes one of them Vale. The shared rules cannot
drift apart between agents because there is only one copy of them, and the
attestation covers every character at once.

| `AGENT` | Role |
| --- | --- |
| `sloane` | Vault custodian. Mints the 40 USDG bounty for a report naming the thief. |
| `vale` | Detective. Buys clues at 3 USDG, writes the report, claims the bounty. |
| `gray` | Suspect. |
| `kit` | Suspect. Posts what he is paid to post and says so. |
| `shinichi` | Informant, not a suspect. Sells Vale clues he can support. |
| `validator` | Validator. Closes covenants once he has checked both legs himself. Holds the evaluator role and no `AGENT_ROLE`. |

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

Create `agents/<slug>/system.md` and set `AGENT=<slug>`. `requireKnownAgent()`
checks at startup that the directory exists and lists what does, so a typo in
`AGENT` fails immediately rather than mid-covenant.

A character file should cover the agent's situation, who they are, and their
register. It should not restate anything in `_common.md` — if a rule needs to
hold for everyone, it belongs there instead.
