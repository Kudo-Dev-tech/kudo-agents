# kudo-launcher

A UI and API for launching Kudo agents. A user writes a system prompt and picks
or uploads skills; the launcher turns that into an agent with its own wallet,
its own ERC-8004 identity and its own container, running the same
[`kudo-agent`](../kudo-agent) image as the built-in characters.

## Gas is sponsored

**Kudo pays the gas for every launched agent.** Users never buy or hold ETH.

It works as a gas tank (`src/gas-tank.ts`):

1. A treasury wallet (`TREASURY_PRIVATE_KEY`) holds ETH.
2. At launch, the agent's new wallet gets `GAS_INITIAL_ETH`. That pays for
   registering its identity.
3. Every `GAS_CHECK_SECONDS`, any running agent below `GAS_REFILL_BELOW_ETH`
   is topped up by `GAS_REFILL_ETH`.
4. No agent gets more than `GAS_DAILY_CAP_ETH` per UTC day, including the
   initial funding. Every transfer is recorded in `DATA_DIR/gas-ledger.json`.

The agent then pays gas from its own wallet, so every transaction is an ordinary
one from its EOA. `msg.sender` is the agent, which is what Kudo checks
(`AGENT_ROLE` on mint, `agentWallet` on settlement), and what any other
protocol will see too. No contract needs to support sponsorship.

The trade-off: the gas tank limits **how much** ETH an agent gets, not **what
it is spent on**. The agent's system prompt tells it the ETH is for gas only
(`kudo-agent/agents/_launched.md`), but that is an instruction, not a control.
Keep the refill amounts small. If you later need that control, move to
EIP-7702 with a paymaster (on Robinhood Chain, Alchemy's Gas Manager). The
agent's address would not change.

## What a launch does

| Step | Stage | Who pays |
|---|---|---|
| Validate the submission, write the bundle | - | nothing; a bad submission is a 400 |
| Create the wallet, save its key (mode 600) | `funding` | - |
| Send `GAS_INITIAL_ETH` | `funding` | treasury |
| Register the ERC-8004 identity, signed by the agent | `registering` | agent, from sponsored ETH |
| Grant `AGENT_ROLE` (only if `KUDO_ADMIN_PRIVATE_KEY` is set) | `granting-role` | admin key |
| Start the container | `starting` → `running` | - |

A launch that fails partway is marked `failed` and can be retried from the UI.
Each step checks what already happened, so a retry never funds or registers
twice.

Without `KUDO_ADMIN_PRIVATE_KEY`, agents launch without `AGENT_ROLE`. They can
read covenants and attest asks, but cannot mint until someone grants the role.
The UI shows which agents are waiting.

## The bundle

What the user submits becomes a bundle in `DATA_DIR/agents/<slug>/bundle/`,
mounted read-only into the agent at `/bundle`:

```
system.md                the user's system prompt
skills/<name>/SKILL.md   the user's own skills
prompts/<name>.txt       the user's own scheduled task prompts
```

`kudo-agent` builds its system prompt as `_common.md` + `_launched.md` +
`system.md`, so Kudo's rules always come first. Platform skills
(`kudo-covenants`, plus `chain-forensics` and `twitter` when chosen) are copied
next to the user's; a user skill may not take a platform skill's name.

Twitter is enabled only when the user supplies their own X credentials. Launched
agents never get Kudo's account.

## Hosting

Launched agents don't run on Phala; they run as containers on one host. The
cheapest option is a single small VPS (for example a Hetzner CX22: 2 vCPU,
4 GB, around €4/month). With the default limits (`AGENT_MEMORY=768m`,
`AGENT_CPUS=0.5`) that fits about four agents; size up as you go.
Most of an agent's time is spent waiting on the model or the RPC, so CPU is
rarely the constraint.

Without a TEE there is no attestation. `kudo-agent` already handles that: the
agent registers its name without a `teeId`, and `GET /identity` reports
`attested: false`. Users are trusting whoever runs the host.

```bash
cp .env.example .env              # fill in the token, keys and DATA_DIR
docker build -t kudo-agent:local ../kudo-agent
docker compose up -d              # UI on :8080
```

Put a TLS reverse proxy in front of `:8080` before exposing it.

For development without Docker for the launcher itself, `cast` and `docker`
must be on `PATH`:

```bash
npm install
npm run dev
```

## API

Every `/api` route needs `Authorization: Bearer $LAUNCHER_TOKEN`.

| Route | Does |
|---|---|
| `GET /api/config` | network, gas sponsorship terms, treasury balance |
| `GET /api/agents` | every agent, with container state, ETH balance and role |
| `POST /api/agents` | launch one: `{name, systemPrompt, skills: [{content}], chainForensics, jobs: [{task, seconds, prompt?}], twitter?}` |
| `POST /api/agents/:slug/retry` | resume a failed launch |
| `POST /api/agents/:slug/stop` and `/start` | stop or resume the container |
| `GET /api/agents/:slug/logs` | the container's recent output |
| `POST /api/agents/:slug/message` | `{"message": "..."}`, forwarded to the agent |

## Known limits

- **One shared token.** Anyone holding `LAUNCHER_TOKEN` can launch agents, and
  every launch spends treasury ETH. There are no per-user accounts yet, so every
  token holder sees every agent.
- **The agent can read its own key**, as in `kudo-agent`. User-written skills
  make that worse, not better: a skill is instructions given to a model with a
  shell. The gas tank caps the ETH at risk; USDG the agent holds is not capped.
- **One `ANTHROPIC_API_KEY` for every agent**, and readable from inside each
  container. Use a dedicated key with a spend limit.
- **`_common.md` includes the Vault case** written for the built-in characters,
  so launched agents read it too. Move it into those characters' own files if
  that becomes confusing.
