// Kudo Agent Launcher UI. No framework and no build step: the launcher serves
// this file as it stands.

const $ = (selector, root = document) => root.querySelector(selector);

const TOKEN_KEY = "kudo-launcher-token";
const LAUNCH_STAGES = ["funding", "registering", "granting-role", "starting", "running"];
const STAGE_LABEL = {
  funding: "Funding wallet",
  registering: "Registering identity",
  "granting-role": "Granting AGENT_ROLE",
  starting: "Starting",
  running: "Running",
  stopped: "Stopped",
  failed: "Failed",
};

let token = readToken();
let settings = null;
let pollTimer = null;

// --- storage: may be unavailable (private mode, blocked site data) ---

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function writeToken(value) {
  try { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

// --- api ---

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showAuth("That token was not accepted.");
    throw new Error("unauthorised");
  }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

// --- small DOM helper: text is always set as text, never parsed as HTML ---

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// --- auth ---

function showAuth(message) {
  $("#auth").hidden = false;
  $("#app").hidden = true;
  $("#signout").hidden = true;
  const error = $("#auth-error");
  error.hidden = !message;
  error.textContent = message || "";
}

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  token = $("#token").value.trim();
  writeToken(token);
  await start();
});

$("#signout").addEventListener("click", () => {
  token = "";
  writeToken("");
  clearTimeout(pollTimer);
  showAuth();
});

// --- config and the gas notice ---

function renderSettings() {
  const { gas, network } = settings;
  $("#gas-terms").textContent =
    `New agents get ${gas.initialEth} ETH at launch. Whenever a running agent drops below ` +
    `${gas.refillBelowEth} ETH it is topped up by ${gas.refillEth} ETH, up to ${gas.dailyCapEth} ETH ` +
    `per agent per day. The gas ETH is for your agent's Kudo transactions only.`;

  const low = $("#gas-low");
  low.hidden = !gas.treasury?.low;
  low.textContent = gas.treasury?.low
    ? `The gas tank is running low (${gas.treasury.balanceEth} ETH). New launches may fail until it is refilled.`
    : "";

  const chip = $("#network");
  chip.hidden = false;
  chip.textContent = network.rpcUrl.includes("testnet") ? "Robinhood Chain testnet" : "Robinhood Chain";

  for (const select of document.querySelectorAll(".job-task")) fillTaskOptions(select, select.value);
}

// --- system prompt ---

const systemInput = $("#system");
systemInput.addEventListener("input", () => {
  $("#system-count").textContent = (new Blob([systemInput.value]).size / 1024).toFixed(1);
});

$("#system-file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) {
    systemInput.value = await file.text();
    systemInput.dispatchEvent(new Event("input"));
  }
  event.target.value = "";
});

// --- skills ---

const PLATFORM_SKILLS = ["kudo-covenants", "twitter", "chain-forensics", "kudo-validation"];

/** Mirrors the launcher's own check, so problems show before submitting. */
function inspectSkill(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return { error: "Needs frontmatter: start with ---, name: and description:." };
  const field = (key) => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(match[1])?.[1].trim().replace(/^["']|["']$/g, "");
  const name = field("name");
  if (!name) return { error: "Frontmatter has no name:." };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return { name, error: "Name must be lowercase letters, digits and dashes." };
  if (PLATFORM_SKILLS.includes(name)) return { name, error: "That name is taken by a platform skill." };
  if (!field("description")) return { name, error: "Frontmatter has no description:." };
  return { name };
}

function addSkill(text = "") {
  const item = $("#skill-tpl").content.firstElementChild.cloneNode(true);
  const area = $("textarea", item);
  area.value = text;
  const update = () => {
    const { name, error } = inspectSkill(area.value);
    $(".skill-name", item).textContent = name || "untitled";
    $(".skill-status", item).textContent = error || "Looks good";
    item.classList.toggle("invalid", Boolean(error) && area.value.trim() !== "");
  };
  area.addEventListener("input", update);
  $(".remove", item).addEventListener("click", () => item.remove());
  $("#skill-list").append(item);
  update();
  return item;
}

$("#skill-add").addEventListener("click", () => $("textarea", addSkill()).focus());
$("#skill-files").addEventListener("change", async (event) => {
  for (const file of event.target.files) addSkill(await file.text());
  event.target.value = "";
});

// --- scheduled tasks ---

function fillTaskOptions(select, current) {
  const tasks = settings?.builtInTasks || { "settle-due": "", "take-work": "" };
  select.replaceChildren(
    ...Object.keys(tasks).map((name) => h("option", { value: name }, name)),
    h("option", { value: "custom" }, "custom prompt…"),
  );
  select.value = current || "settle-due";
  select.dispatchEvent(new Event("change"));
}

function addJob(task = "settle-due", seconds = 120) {
  const item = $("#job-tpl").content.firstElementChild.cloneNode(true);
  const select = $(".job-task", item);
  select.addEventListener("change", () => {
    const custom = select.value === "custom";
    $(".job-custom", item).hidden = !custom;
    $(".job-desc", item).textContent = custom
      ? "Your own prompt, sent to the agent on this schedule."
      : settings?.builtInTasks?.[select.value] || "";
  });
  fillTaskOptions(select, task);
  $(".job-seconds", item).value = seconds;
  $(".remove", item).addEventListener("click", () => item.remove());
  $("#job-list").append(item);
}

$("#job-add").addEventListener("click", () => addJob("take-work", 300));

// --- X credentials toggle the twitter skill ---

const twitterFields = ["#tw-key", "#tw-secret", "#tw-token", "#tw-token-secret", "#tw-handle"];
for (const id of twitterFields) {
  $(id).addEventListener("input", () => {
    $("#twitter-on").checked = twitterFields.every((f) => $(f).value.trim());
  });
}

// --- launch ---

function collect() {
  const twitter = twitterFields.map((f) => $(f).value.trim());
  return {
    name: $("#name").value.trim(),
    systemPrompt: systemInput.value,
    chainForensics: $("#chain-forensics").checked,
    skills: [...document.querySelectorAll("#skill-list textarea")]
      .map((area) => area.value)
      .filter((content) => content.trim())
      .map((content) => ({ content })),
    jobs: [...document.querySelectorAll("#job-list .job")].map((item) => {
      const task = $(".job-task", item).value;
      const seconds = Number($(".job-seconds", item).value);
      return task === "custom"
        ? { task: $(".job-name", item).value.trim(), seconds, prompt: $(".job-prompt", item).value }
        : { task, seconds };
    }),
    twitter: twitter.some(Boolean)
      ? { apiKey: twitter[0], apiSecret: twitter[1], accessToken: twitter[2], accessTokenSecret: twitter[3], handle: twitter[4] }
      : null,
  };
}

$("#launch").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#launch-error");
  const button = $("#launch-btn");
  error.hidden = true;

  const invalid = document.querySelector(".skill.invalid");
  if (invalid) {
    error.hidden = false;
    error.textContent = `Fix skill "${$(".skill-name", invalid).textContent}" first: ${$(".skill-status", invalid).textContent}`;
    return;
  }

  button.disabled = true;
  button.textContent = "Launching…";
  try {
    await api("/api/agents", { method: "POST", body: JSON.stringify(collect()) });
    event.target.reset();
    $("#skill-list").replaceChildren();
    $("#job-list").replaceChildren();
    addJob();
    systemInput.dispatchEvent(new Event("input"));
    await refresh();
  } catch (failure) {
    if (failure.message !== "unauthorised") {
      error.hidden = false;
      error.textContent = failure.message;
    }
  } finally {
    button.disabled = false;
    button.textContent = "Launch agent";
  }
});

// --- agents list ---

const openPanels = new Map(); // slug -> "message" | "logs", kept across refreshes

function explorer(kind, value) {
  const base = settings?.network?.explorerUrl;
  return base ? h("a", { href: `${base}/${kind}/${value}`, target: "_blank", rel: "noopener" }, value) : value;
}

function pill(stage) {
  const kind = stage === "running" ? "running" : stage === "failed" ? "failed" : stage === "stopped" ? "stopped" : "busy";
  return h("span", { class: `pill ${kind}` }, STAGE_LABEL[stage] || stage);
}

function steps(stage) {
  const at = LAUNCH_STAGES.indexOf(stage);
  if (at < 0 || stage === "running") return null;
  return h("div", { class: "steps", "aria-hidden": "true" }, LAUNCH_STAGES.map((_, i) => h("span", { class: i <= at ? "done" : "" })));
}

/** Six decimals is enough to see a refill land; full wei precision is noise. */
const eth = (value) => `${Number(value).toFixed(6).replace(/\.?0+$/, "")} ETH`;

function roleText(agent) {
  if (agent.hasAgentRole === true) return "Granted";
  if (agent.hasAgentRole === false) return settings?.grantsAgentRole ? "Not yet" : "Pending: Kudo grants it by hand. Until then it can't mint.";
  return "Unknown";
}

async function agentAction(slug, action) {
  try {
    await api(`/api/agents/${slug}/${action}`, { method: "POST" });
  } catch (failure) {
    if (failure.message !== "unauthorised") alert(failure.message);
  }
  await refresh();
}

function messagePanel(agent) {
  const input = h("textarea", { rows: 3, placeholder: "Ask your agent something, e.g. What covenants are open?" });
  const answer = h("div", { class: "answer", hidden: true });
  const send = h("button", { type: "button", class: "small" }, "Send");
  send.addEventListener("click", async () => {
    if (!input.value.trim()) return;
    send.disabled = true;
    send.textContent = "Working… (can take minutes)";
    answer.hidden = false;
    answer.textContent = "";
    try {
      const body = await api(`/api/agents/${agent.slug}/message`, { method: "POST", body: JSON.stringify({ message: input.value }) });
      answer.textContent = body.response || "(no response)";
    } catch (failure) {
      answer.textContent = failure.message;
    } finally {
      send.disabled = false;
      send.textContent = "Send";
    }
  });
  return h("div", { class: "panel stack" }, input, h("div", {}, send), answer);
}

function logsPanel(agent) {
  const pre = h("pre", {}, "Loading…");
  api(`/api/agents/${agent.slug}/logs`)
    .then((body) => { pre.textContent = body.logs || "(no output yet)"; pre.scrollTop = pre.scrollHeight; })
    .catch((failure) => { pre.textContent = failure.message; });
  return h("div", { class: "panel" }, pre);
}

function agentCard(agent) {
  const panel = openPanels.get(agent.slug);
  const toggle = (kind) => () => {
    openPanels.get(agent.slug) === kind ? openPanels.delete(agent.slug) : openPanels.set(agent.slug, kind);
    render(lastAgents);
  };

  const actions = [];
  if (agent.stage === "running") {
    actions.push(h("button", { type: "button", class: "small", onclick: toggle("message") }, panel === "message" ? "Close" : "Message"));
    actions.push(h("button", { type: "button", class: "ghost small", onclick: () => agentAction(agent.slug, "stop") }, "Stop"));
  }
  if (agent.stage === "stopped") {
    actions.push(h("button", { type: "button", class: "small", onclick: () => agentAction(agent.slug, "start") }, "Start"));
  }
  if (agent.stage === "failed") {
    actions.push(h("button", { type: "button", class: "small", onclick: () => agentAction(agent.slug, "retry") }, "Retry"));
  }
  if (["running", "stopped", "failed"].includes(agent.stage)) {
    actions.push(h("button", { type: "button", class: "ghost small", onclick: toggle("logs") }, panel === "logs" ? "Hide logs" : "Logs"));
  }

  return h("article", { class: "agent" },
    h("div", { class: "agent-head" },
      h("div", {}, h("h3", {}, agent.name), h("span", { class: "slug" }, agent.slug)),
      pill(agent.stage),
    ),
    steps(agent.stage),
    agent.error && h("p", { class: "error" }, agent.error),
    h("dl", { class: "facts" },
      h("dt", {}, "Wallet"), h("dd", { class: "mono-s" }, explorer("address", agent.address)),
      h("dt", {}, "Agent ID"), h("dd", {}, agent.agentId ?? "-"),
      h("dt", {}, "Gas"), h("dd", {}, agent.balanceEth != null ? `${eth(agent.balanceEth)} · sponsored, ${eth(agent.gasSentTodayEth)} sent today` : "-"),
      h("dt", {}, "AGENT_ROLE"), h("dd", {}, roleText(agent)),
      h("dt", {}, "Skills"), h("dd", {}, agent.skills.join(", ")),
      h("dt", {}, "Tasks"), h("dd", {}, agent.jobs ? agent.jobs.split(",").map((job) => job.replace(/:(\d+)$/, " every $1s")).join(", ") : "None, answers messages only"),
    ),
    actions.length > 0 && h("div", { class: "agent-actions" }, actions),
    panel === "message" && agent.stage === "running" && messagePanel(agent),
    panel === "logs" && logsPanel(agent),
  );
}

let lastAgents = [];

function render(agents) {
  lastAgents = agents;
  // Don't rebuild a card whose message panel is mid-conversation.
  const busy = document.querySelector(".panel button:disabled");
  if (busy) return;
  $("#agents").replaceChildren(...agents.map(agentCard));
  $("#agents-empty").hidden = agents.length > 0;
}

async function refresh() {
  clearTimeout(pollTimer);
  try {
    const { agents } = await api("/api/agents");
    render(agents);
    // Poll fast while a launch is in progress, slowly otherwise.
    const launching = agents.some((a) => LAUNCH_STAGES.includes(a.stage) && a.stage !== "running");
    pollTimer = setTimeout(refresh, launching ? 3000 : 30000);
  } catch (failure) {
    if (failure.message !== "unauthorised") pollTimer = setTimeout(refresh, 10000);
  }
}

$("#refresh").addEventListener("click", refresh);

// --- start ---

async function start() {
  if (!token) return showAuth();
  try {
    settings = await api("/api/config");
  } catch (failure) {
    if (failure.message !== "unauthorised") showAuth(failure.message);
    return;
  }
  $("#auth").hidden = true;
  $("#app").hidden = false;
  $("#signout").hidden = false;
  renderSettings();
  if (!$("#job-list").children.length) addJob();
  await refresh();
}

start();
