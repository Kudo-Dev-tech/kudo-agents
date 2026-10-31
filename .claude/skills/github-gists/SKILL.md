---
name: github-gists
description: Publish a report as a public GitHub gist and read back the URL that settles a covenant's leg. Use whenever a task involves publishing a research report, producing the URL that settles a report leg, or reading a published report back to verify one. Covers the token and its single scope, the pre-flight that catches a wrong-scope token, the create call, which URL to attest and how a reader checks whether a gist changed after it was judged.
---

# Publishing a report as a gist

A report is too long for a post and has to live somewhere a covenant can point
at. This agent publishes it as a **public gist** through the GitHub REST API,
with `curl` and `node` — there is no `git` in the image and none is needed.

A tweet announces a report. The gist **is** the report, and its URL is what
settles the leg.

## Credentials

| Variable | From |
|---|---|
| `GITHUB_TOKEN` | a token whose only power is gists |

One variable. The token is either a classic PAT with the `gist` scope and
nothing else ticked, or a fine-grained PAT with Account permissions → Gists:
read and write and no repository access. Either way it cannot read or write a
repository, which is deliberate: this agent has a shell and can read its own
environment, so the token is scoped to the smallest thing that does the job.

If `GITHUB_TOKEN` is unset or empty, stop and say so. Do not publish the report
anywhere else instead.

## Pre-flight: can this token create a gist?

Run this before writing the first report of a session. It is a read.

```bash
curl -si -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user | sed -n '1p;/^x-oauth-scopes:/Ip;/^x-ratelimit-remaining:/Ip;/"login"/p'
```

Three outcomes:

- **`200` and a `login`** — the token authenticates. If `x-oauth-scopes` is
  present it must list `gist`; if it lists something else, stop.
- **`200` and no `x-oauth-scopes` header at all** — a fine-grained token, whose
  permissions are not reported here. There is no read that proves it can write
  a gist; the create call below is the test, and its failure modes are in the
  table at the end.
- **`401`** — the token is wrong, revoked or expired. Expiry is the common one:
  a fine-grained PAT lasts at most a year and dies silently.

## Write the report to a file first

Build the markdown as a file, never as a shell string. A report contains
backticks, quotes, apostrophes, `$` and newlines, all of which break either the
shell or the JSON body if interpolated.

```bash
cat > /tmp/report.md <<'EOF'
# Pons — tokenomics

Total supply 1,000,000,000 PONS (`totalSupply()` = 1000000000000000, decimals
6, read at block 1234567).

...
EOF
```

A quoted heredoc (`<<'EOF'`) interpolates nothing, so nothing needs escaping.

## Create the gist

`node` reads the file and builds the JSON, so the markdown never passes through
a shell argument:

```bash
node -e '
const fs = require("fs");
const [file, name, description] = process.argv.slice(1);
fetch("https://api.github.com/gists", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.GITHUB_TOKEN,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    description,
    public: true,
    files: { [name]: { content: fs.readFileSync(file, "utf8") } },
  }),
}).then(async r => {
  const b = await r.json();
  if (!r.ok) { console.error("FAILED", r.status, JSON.stringify(b)); process.exit(1); }
  const raw = b.files[name].raw_url;
  const sha = (b.history && b.history[0] && b.history[0].version) || "";
  // The attested URL must name a revision. raw_url normally already does; if a
  // 40-character hex segment is missing, build it from the revision instead.
  console.log(/\/[0-9a-f]{40}\//.test(raw)
    ? raw
    : "https://gist.githubusercontent.com/" + b.owner.login + "/" + b.id + "/raw/" + sha + "/" + name);
});' /tmp/report.md "pons-tokenomics.md" "Pons tokenomics research"
```

It prints one URL and nothing else, so it can be used directly as settlement
data.

`public: true` matters. A "secret" gist is reachable by URL but unlisted, and
the point of publishing is that anyone holding a covenant can find and check
the report without being handed a link.

Name the file for the subject and the section — `pons-tokenomics.md`,
`pons-market.md` — so the URL says what it is.

## The URL you attest

**Attest the gist's own URL**, the `html_url` from the create response:

```
https://gist.github.com/<login>/<gist id>
```

Not the raw revision URL. The gist URL is the one a person opens and reads, and
it is what a counterparty expects to be handed.

Know what that costs. The gist URL follows the gist, so its content can change
after a validator has read it and closed the covenant — and COMPLETED cannot be
undone. What replaces the guarantee is the audit trail: every revision is
public at `https://api.github.com/gists/<id>` with a `committed_at` for each, so
an edit made after judgement is visible to anyone who looks. The raw revision
URL is still the right thing to quote inside a report when you cite another
report, because there the point is to name exact bytes.

## Never edit a published report

Once a gist's URL is attested, leave the gist alone. A correction is a **new**
gist, published and attested on its own covenant, with a line in it naming what
it corrects. Editing in place is how a reader following the gist ends up seeing
different text from the one the validator approved.

## Reading a report back

Anyone can read a public gist with no token, which is what makes it evidence:

```bash
curl -sL "<raw revision URL>"
```

Use the raw URL rather than the API for verification. Unauthenticated API
requests are limited to 60 an hour per IP, and a validator on a timer will
exhaust that; `gist.githubusercontent.com` is not on the API's limit. The API
is there when metadata matters:

```bash
curl -s -H "Accept: application/vnd.github+json" https://api.github.com/gists/<gist id>
```

`created_at`, `history[].committed_at` and `owner.login` come from there — the
publication time, every revision, and who published it.

## What the statuses mean

| Response | Cause | Fix |
|---|---|---|
| `404` on `POST /gists` | a classic token without the `gist` scope. GitHub hides what you may not touch rather than admitting it exists | Tick `gist` on the token, or re-mint it — a scope added to an existing classic PAT applies immediately, but confirm with the pre-flight |
| `403` with `"Resource not accessible by personal access token"` | a fine-grained token without Gists: read and write | Edit the token's Account permissions. Repository permissions are irrelevant here |
| `401 Bad credentials` | wrong, revoked or expired token | Re-mint it. Check the expiry date before blaming anything else |
| `422` | the body is malformed — usually an empty `files` object or an empty `content` | Report is empty or the file never got written. Check the file exists and is non-empty before posting |
| `403` with `x-ratelimit-remaining: 0` | 5,000 requests an hour exhausted, which at these intervals should not happen | Wait for `x-ratelimit-reset`. Say that you were rate limited; do not retry in a loop |

A `404` here is a permissions problem, never a missing endpoint. That is the
one failure worth recognising on sight, because it reads like the opposite.

## After publishing

The gist's own URL is the deliverable. Write it as the covenant's settlement
data, and when the leg also wants a payment or several reports, put every URL
in full in the one settlement string — see the kudo-covenants skill for which
party signs which leg.

Never claim a report was published without a URL from a successful response,
and never reuse an earlier report's URL to settle a new covenant. If the
publish failed, say so, show the status and the body, and leave the covenant
alone — an unattested leg can be settled on the next run; a wrong attestation
cannot be taken back.
