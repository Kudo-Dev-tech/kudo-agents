// Demo mode: the UI with no launcher behind it.
//
// Used when the page is served somewhere that has no /api (a static preview on
// Vercel, say) or when the URL has ?demo. Everything here is made up and stays
// in this tab: nothing is launched, no wallet is created and no ETH moves.
// app.js routes its api() calls here instead of fetch().

(() => {
  const STAGES = ["funding", "registering", "granting-role", "starting", "running"];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomHex = (bytes) =>
    `0x${[...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

  const config = {
    network: {
      rpcUrl: "https://rpc.testnet.chain.robinhood.com",
      explorerUrl: "https://explorer.testnet.chain.robinhood.com",
      kudo: "0x7021279517a7b301b8d10eD9c3b9F73C101146f1",
    },
    gas: {
      sponsored: true,
      initialEth: "0.003",
      refillBelowEth: "0.001",
      refillEth: "0.002",
      dailyCapEth: "0.01",
      treasury: { address: "0x0000000000000000000000000000000000000000", balanceEth: "1.25", low: false },
    },
    grantsAgentRole: true,
    builtInTasks: {
      "settle-due": "Keep the promises this agent owes once they are due.",
      "take-work": "Find one unclaimed open ask that fits this agent, perform it and attest it.",
    },
  };

  const agents = [
    {
      slug: "ledger-lark",
      name: "Ledger Lark",
      address: "0x9E50aaD542879268A677556c1d538262a195de18",
      agentId: "41",
      port: 4100,
      skills: ["kudo-covenants", "chain-forensics", "bookkeeping"],
      jobs: "settle-due:120,weekly-report:3600",
      stage: "running",
      error: null,
      createdAt: "2026-10-29T09:12:00.000Z",
      container: "running",
      balanceEth: "0.002458",
      hasAgentRole: true,
      gasSentTodayEth: "0.005",
    },
    {
      slug: "retry-robin",
      name: "Retry Robin",
      address: "0xe1e1A4fDB9762fBCc5c106b8A3aF2730548f2223",
      agentId: "42",
      port: 4101,
      skills: ["kudo-covenants"],
      jobs: "",
      stage: "stopped",
      error: null,
      createdAt: "2026-10-28T15:40:00.000Z",
      container: "exited",
      balanceEth: "0.002984",
      hasAgentRole: true,
      gasSentTodayEth: "0.003",
    },
  ];

  const find = (slug) => agents.find((agent) => agent.slug === slug);
  const copy = (value) => JSON.parse(JSON.stringify(value));

  /** Walks a new agent through the launch stages, a little over a second each. */
  async function provision(agent) {
    for (const stage of STAGES.slice(1)) {
      await sleep(1400);
      agent.stage = stage;
      if (stage === "registering") agent.agentId = String(43 + agents.indexOf(agent));
      if (stage === "granting-role") agent.hasAgentRole = true;
      if (stage === "running") agent.container = "running";
      agent.balanceEth = "0.002969";
    }
  }

  function launch(body) {
    const name = String(body.name || "").trim();
    if (!name) throw new Error("Name must be 1 to 48 characters.");
    if (!String(body.systemPrompt || "").trim()) throw new Error("The system prompt is empty.");

    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agent";
    for (let n = 2; find(slug); n++) slug = `${slug.replace(/-\d+$/, "")}-${n}`;

    const skillNames = (body.skills || []).map((s) => /^name:\s*(.+)$/m.exec(s.content)?.[1].trim()).filter(Boolean);
    const agent = {
      slug,
      name,
      address: randomHex(20),
      agentId: null,
      port: 4100 + agents.length,
      skills: ["kudo-covenants", ...(body.twitter ? ["twitter"] : []), ...(body.chainForensics ? ["chain-forensics"] : []), ...skillNames],
      jobs: (body.jobs || []).map((job) => `${job.task}:${job.seconds}`).join(","),
      stage: "funding",
      error: null,
      createdAt: new Date().toISOString(),
      container: "missing",
      balanceEth: "0",
      hasAgentRole: false,
      gasSentTodayEth: "0.003",
    };
    agents.unshift(agent);
    void provision(agent);
    return { agent: copy(agent) };
  }

  async function api(path, options = {}) {
    await sleep(250);
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : {};

    if (path === "/api/config") return copy(config);
    if (path === "/api/agents" && method === "GET") return { agents: copy(agents) };
    if (path === "/api/agents" && method === "POST") return launch(body);

    const [, slug, action] = /^\/api\/agents\/([a-z0-9-]+)\/(\w+)$/.exec(path) || [];
    const agent = find(slug);
    if (!agent) throw new Error(`No agent "${slug}".`);

    if (action === "stop") Object.assign(agent, { stage: "stopped", container: "exited" });
    else if (action === "start") Object.assign(agent, { stage: "running", container: "running" });
    else if (action === "logs") {
      return {
        logs: [
          `running as ${agent.slug} (launched, bundle /bundle)`,
          "no TEE app id — running without attestation",
          ...agent.jobs.split(",").filter(Boolean).map((job) => `09:12:01 ${job.split(":")[0]}: every ${job.split(":")[1]}s`),
          "listening on :3000",
          "09:12:14 settle-due: Nothing is due: 0 covenants in progress with an attested ask.",
        ].join("\n"),
      };
    } else if (action === "message") {
      await sleep(1200);
      return {
        response:
          "This is demo mode, so no agent ran. On a real launcher this message goes to " +
          `${agent.name}'s container, which answers using its system prompt and skills.`,
      };
    }
    return { agent: copy(agent) };
  }

  window.kudoDemo = { api };
})();
