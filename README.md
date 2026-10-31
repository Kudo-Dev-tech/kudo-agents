# kudo-agents

Autonomous agents that mint, keep and settle Kudo covenants on-chain, built on
the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk). Every agent
runs the same image in its own Phala CVM; one environment variable, `AGENT`,
decides which one it is.

**No custom tools.** The agent works at a shell the way a person would: `cast`
for the chain, `node` to sign X API requests. What it knows lives in skills.

```
src/main.ts              the one entry point: server + scheduled jobs
src/agent/               runAgent(prompt), and the system prompt it assembles
src/server/              the HTTP endpoint
src/cron.ts              the scheduled jobs
src/tee.ts               reads the Phala app id at startup
.claude/skills/          kudo-covenants, twitter, github-gists,
                         chain-forensics, kudo-validation — what it knows
prompts/                 task prompts several agents share
agents/<slug>/           who each agent is: character, metadata, own prompts
Dockerfile               node + cast + curl
```

Skills live under `.claude/skills/` because that is the exact path the SDK
scans, relative to the working directory — a plain `skills/` is not found. The
name is the SDK's, not a preference. Nothing in `src/` reads those files: the
SDK discovers them, advertises them, and registers the `Skill` tool the model
calls to pull one into context. The `skills` option selects which of the
discovered skills a given agent gets, and is also what permits that tool —
naming `Skill` in `allowedTools` is deprecated in favour of it.

`settingSources` is the gate on all filesystem discovery: `[]` finds nothing,
while omitting it behaves the same as `["project"]`. It is set explicitly so
the behaviour is pinned here rather than inherited from a default.

The skills are separate because they are independent — the covenant protocol
does not care how a tweet gets posted or where a report is published, and
neither of those cares about covenants. They meet at one point: a URL is what
settles a covenant leg. A post's URL settles a post; a report is published as a
public gist and settles with the gist's raw revision URL, which is fixed bytes
rather than an address whose contents can be edited after a validator has read
them.

## The agents

A trader wants a research report on one token and no single agent writes it.
Instead a chain of covenants forms: an analyst borrows to commission three
specialist reports, pays a synthesizer to combine them, delivers the result, and
the money unwinds back down the chain with interest. Nobody coordinates it —
each agent mints the covenant describing what it will do for whom, and the
chain assembles itself out of agents finding work they can perform.
[`docs/research-chain.md`](docs/research-chain.md) has the covenants, the
sequence and where the money ends up.

| `AGENT` | Who | Role |
| --- | --- | --- |
| `trader` | Sloane | Wants the report. Mints the INVOICE promising 100 USDG for it, and pays once the figures check out. |
| `analyst` | Vale | The general contractor. Borrows 40, commissions four asks, delivers the report, repays 50. |
| `market` | Kit | Market research — price, liquidity, volume, venues. Fastest, and labels what he did not check. |
| `business` | Marlowe | Business research — who is behind the token and what corroborates the claims. |
| `tokenomics` | Calder | Tokenomics — supply, concentration, mint authority, actual emission. |
| `synthesizer` | Reeve | Combines the three reports into one and names every place they disagree. |
| `lender` | Gray | Lends the analyst 40 at 50, having borrowed the 100 from a human at 101. |
| `developer` | Hale | Builds contracts and small web apps. Delivers a testnet address and a call that proves it works, never a description. |
| `validator` | Megure | Closes covenants once both legs check out. Holds the evaluator role and no `AGENT_ROLE`. |

`src/agent/prompts.ts` concatenates `agents/_common.md` and
`agents/<AGENT>/system.md` into the system prompt. Nothing else differs between
agents, so the shared rules cannot drift apart and the attestation covers the
whole set at once. See [`agents/README.md`](agents/README.md) for what each one
runs and how to add one.

## Running it

One process, one entry point. `src/main.ts` starts the HTTP endpoint and the
scheduled jobs together — the shape a Phala CVM deploys.

```bash
cp .env.example .env                      # chain and API keys
cp agents/.env.example agents/analyst/.env   # that agent's key, identity, jobs
npm install
npx tsx --env-file=.env --env-file=agents/analyst/.env src/main.ts
```

Both files are passed explicitly because **nothing loads them implicitly** —
there is no `dotenv` dependency, and `npm run dev` starts a process with
whatever is already exported, so on its own it exits with `Missing required
environment variables`. In a CVM the values come from the Phala dashboard
instead, which is why the image needs no such flag.

Point it at **testnet** before mainnet. `.env` ships set to testnet; the
mainnet block is commented out below it.

| Endpoint | Does |
|---|---|
| `POST /message` | `{"message": "..."}` → `{"response": "..."}` — one agent run |
| `GET /identity` | `name`, `agentId`, `teeId`, `attestation`, and `attested` — false for a hand-set `TEE_ID` |
| `GET /health` | liveness |

```bash
curl -s localhost:3000/message -H 'content-type: application/json' \
  -d '{"message":"What covenants are open?"}'
```

A run can take minutes, so `/message` disables the socket timeout. There is no
queue: a second request starts a second run.

## Scheduled jobs

`src/cron.ts` runs the prompts named in `JOBS` on their own intervals. The main
one is `settle-due`: the agent lists its covenants, finds the ones whose promise
is due, and keeps each according to what it says — pay the USDG and attest with
the transaction hash, or publish the post or report and attest with its URL.
Either way the proof is written only after the thing it attests demonstrably
happened.

`JOBS` is `<prompt>:<seconds>`, comma separated, ten seconds minimum; with it
unset, `TICK_INTERVAL_SECONDS` runs `settle-due` alone (default 300, `0`
disables). Jobs keep separate schedules but share one signing key, so only one
run happens at a time — a second would collide on the nonce and lose both
transactions. A failed run is logged and skipped rather than stopping the loop,
and each job runs once at startup, so every process start costs a model call
per job regardless of the interval.

Prompts are files so an operational run is reviewable and version controlled
rather than retyped at a shell. Changing what a round does means editing the
`.txt`, not the code.

## Docker

```bash
docker compose up -d
```

`docker-compose.yml` is the file Phala hashes and publishes, so it pins the
image **by digest** rather than by tag: a tag can be repointed at different
bytes later, which would make the attestation report prove nothing about the
code. Push your build and replace the digest before deploying. Secrets are
`${VARS}` declared in the Phala dashboard, never values in the file.

`stop_grace_period` is 180s and `SHUTDOWN_GRACE_SECONDS` defaults to 120, so a
settlement round in flight finishes rather than being killed between a payment
and its attestation. Keep the process grace below the orchestrator's, or the
container is SIGKILLed first and the graceful path never runs.

`cast` is baked in from `ghcr.io/foundry-rs/foundry` rather than installed at
runtime — an agent that bootstraps its own toolchain fails slowly and mid-task,
and in a TEE it weakens what attestation says about the image. Pin the Foundry
digest; flags drift between releases.

## Verifying what is running

In a Phala CVM the agent reads its app id from `/var/run/dstack.sock` at
startup, registers it as `teeId` metadata on its ERC-8004 identity, and serves
it from `GET /identity`. That id is the last path segment of its Trust Center
report:

```
https://trust.phala.com/app/<teeId>
```

Anyone holding a covenant against the agent can open it and see — checked
independently of the agent, which has every incentive to lie — that the code
runs on genuine Intel TDX hardware, on an unmodified dstack OS, from the compose
file and image digest the report names. The digest is what ties the report back
to the skills and prompts here.

Outside a TEE there is no app id. The agent still runs; `teeId` and
`attestation` come back `null`, and it registers its name alone.

Agents register with an **empty** token URI: the facts live in on-chain
metadata rather than at a URL that can rot. The `agent-card.json` in an agent's
directory is the human-readable copy of that metadata.

## What the agent can and cannot do

The intent is `Bash` and `Skill` and nothing else. `allowedTools` alone would
not achieve it — that is an auto-approve list, not a filter, and leaves every
other built-in tool plus any connector on the API key's account visible to the
model. Denying them by name in `disallowedTools` is what achieves it: the steady-state
list is `Bash` and `Skill`. Four MCP resource tools (`ListMcpResourcesTool`,
`ReadMcpResourceDirTool`, `ReadMcpResourceTool`, `WaitForMcpServers`) are
advertised transiently while MCP servers are probed — the `mcp__*` pattern does
not match those names — and drop out once none are found.

**The exposed set depends on the model.** Haiku 4.5 advertises four `Task*`
tools that Opus 5 does not; they are denied by name for that reason. Re-check
the list after changing `model` — a deny list written against one model does
not transfer. `permissionMode: "dontAsk"` then denies
anything not pre-approved, because no human is at the keyboard.

An agent holds `AGENT_ROLE`, so it can mint and attest its own promises. It does
**not** hold `EVALUATOR_CONTRACT_ROLE`, so it cannot close covenants — that
stays with the validator key.

## Known limits of this PoC

**The key is in the environment and the agent has a shell**, so the agent can
read its own key — and its `GITHUB_TOKEN`, which is why that token carries the
`gist` scope alone and can reach no repository. Covenant asks are written by
counterparties and read from chain, which makes on-chain text an untrusted
input path. Fine for a proof of
concept; before anything real, either move writes behind typed tools or put the
key behind a signer that enforces amount and recipient policy.

**Shell output is not schema-validated.** A typed tool would compute a repayment
amount in code; here the model composes the whole `cast send`. The skill file
compensates by stating amounts in ETH and keeping one numeral per promise, but
that is a convention, not an enforcement.

**Settlement rounds cost a model call each.** The loop wakes on a timer and asks
the agent to look, rather than waking on a chain event. A model-free watcher
that only prompts when a covenant is actually due would be cheaper; this is the
simple version.
