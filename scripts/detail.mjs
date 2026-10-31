#!/usr/bin/env node
/**
 * Builds a covenant's `promiseDetail` string.
 *
 * `promiseDetail` is the one channel from the counterparty back to the minter,
 * and it is read by a machine before it is read by a person. It carries
 * parameters — a URL, an address, a token — and nothing else. Prose in this
 * field is clutter that every future reader has to parse around, and anything
 * the minter already knows (its own RPC endpoint, the chain it is on, the fact
 * that an ADVANCE owes no payment back) does not belong in it at all.
 *
 * So the format is `key: value`, space separated, one line:
 *
 *   spec: https://gist.github.com/…
 *   spec: https://gist.github.com/… token: 0x39dB…
 *   pay: 0xDE5e…
 *
 * Usage:
 *   node scripts/detail.mjs --spec <url> [--token <address>] [--pay <address>]
 *   node scripts/detail.mjs --report <url> --pay <address>
 *
 * Every value is validated, because a malformed address or a half-copied URL
 * in this field is permanent once attested.
 */

const KEYS = {
  spec: { label: "spec", check: url },
  report: { label: "report", check: url },
  token: { label: "token", check: address },
  pay: { label: "pay", check: address },
};

function url(v) {
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new Error(`not a URL: ${v}`);
  }
  if (u.protocol !== "https:") throw new Error(`not https: ${v}`);
  if (v.includes("/raw/") || v.endsWith("/raw"))
    throw new Error(`raw gist URL — attest the gist's own address: ${v}`);
  return u.toString().replace(/\/$/, "");
}

function address(v) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`not an address: ${v}`);
  return v;
}

function build(argv) {
  const parts = [];

  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];

    if (!KEYS[flag]) {
      const known = Object.keys(KEYS).map((k) => "--" + k).join(" ");
      throw new Error(`unknown flag --${flag}. Use: ${known}`);
    }
    if (value === undefined) throw new Error(`--${flag} needs a value`);

    parts.push(`${KEYS[flag].label}: ${KEYS[flag].check(value)}`);
  }

  if (parts.length === 0) {
    throw new Error("nothing to build — pass at least one of --spec --report --token --pay");
  }
  return parts.join(" ");
}

// A stack trace here is noise: every failure is a bad argument, and the message
// is the whole of what the caller needs.
try {
  process.stdout.write(build(process.argv.slice(2)) + "\n");
} catch (e) {
  console.error(`detail: ${e.message}`);
  process.exit(1);
}
