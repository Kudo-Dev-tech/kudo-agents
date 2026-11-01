---
name: new-agent
description: Provision a new Kudo agent from its Notion plan — reuse or generate its key in kudo-agent/.keys/<slug>.key, write kudo-agent/agents/<slug>/ with a system.md built from the plan, and register its ERC-8004 identity through the gas-sponsored path. Use when asked to add, create, set up or onboard an agent (including the validator).
---

# Adding a Kudo agent

Run from `kudo-agent/`. The shared `.env` there must hold `RPC_URL`,
`IDENTITY_REGISTRY`, `ALCHEMY_API_KEY` and `ALCHEMY_POLICY_ID` for the network
the agent will live on, and `cast` must be on the PATH.

## 1. Read the plan

Fetch the agent's plan from Notion. Take from it the **slug** (lowercase,
letters, digits and dashes; it becomes the `AGENT` value and the directory
name), the **display name** registered on-chain as `AGENT_NAME`, and the
character: situation, who they are, register, and what work is theirs.

If the plan does not settle the slug or the name, ask rather than inventing
one — the name is written on-chain permanently.

## 2. Key — check first, generate only if missing

```bash
ls -l .keys/<slug>.key 2>/dev/null || echo "no key yet"
```

Never overwrite an existing key, and never print one. The provisioning script
in step 4 generates it (mode 600, in the gitignored `.keys/`) only when the
file is absent, so you normally just let it.

## 3. Write `agents/<slug>/system.md`

Follow the shape of the existing characters (`agents/kit/system.md`,
`agents/shinichi/system.md`):

```
# You are <Name>

<one paragraph: their position in the scenario>

## Your position
## Who you are
## The line you hold        (if the plan gives them one)
## Your register
```

Build it from the plan, and keep only what is specific to this agent.
Anything that holds for every agent — covenant mechanics, honesty rules,
how to transact, the case background — already lives in `agents/_common.md`
and must not be restated. Do not invent facts the plan does not state, such
as balances, clients or history: `_common.md` forbids the agent from asserting
them, and a character file that asserts them contradicts it.

If the plan gives the agent task prompts of its own, put them in
`agents/<slug>/prompts/<name>.txt`; shared prompts stay in `prompts/`.

## 4. Provision and register

First without registering, to learn the address:

```bash
node scripts/provision-agent.mjs <slug> --name "<AGENT_NAME>" --no-register
```

Add the printed address to the Gas Manager policy's sender allowlist (the
user does this in the Alchemy dashboard — ask them to, and wait). Then:

```bash
node scripts/provision-agent.mjs <slug> --name "<AGENT_NAME>"
```

This registers the identity via `scripts/sponsored-send.mjs`. That first
sponsored transaction also carries the address's EIP-7702 delegation, so the
agent keeps its EOA address — the one that now owns the identity. The script
skips registration if the address already owns an identity, and writes the new
`AGENT_ID` into `agents/<slug>/.env`.

If it reports an **unknown outcome**, do not run it again until
`cast call $IDENTITY_REGISTRY 'balanceOf(address)(uint256)' <address> --rpc-url $RPC_URL`
shows whether the registration landed. A second registration is a second,
permanent identity.

## 5. Finish

- Fill `JOBS`, `SKILLS` and `AGENT_ENDPOINT` in `agents/<slug>/.env` (see
  `agents/.env.example` and `agents/README.md` for each character's values).
- Add the agent to the tables in `agents/README.md`.
- Tell the user what still needs an admin: granting `AGENT_ROLE` on `KUDO` to
  the address (or `EVALUATOR_CONTRACT_ROLE` for the validator).
- Commit `agents/<slug>/system.md` and any prompts. Never commit `.keys/` or
  any `.env` — both are gitignored; check `git status` before committing.

Report the slug, address, `agentId` and registration transaction hash.
