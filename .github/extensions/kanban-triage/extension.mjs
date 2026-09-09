// Extension: kanban-triage
// Kanban board canvas for triaging GitHub issues, with top-priority section and add-to-context action
//
// This single-file skeleton is a starting point. For more complex canvases
// (multiple actions with non-trivial logic, shared state, a custom renderer,
// etc.) prefer splitting things out: move each action handler into its own
// function, extract `open`/`onClose` into helpers, and pull large units
// (renderer assets, schema definitions, shared utilities) into sibling files
// imported from this entry point. Keep extension.mjs focused on wiring.

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";

const execFileAsync = promisify(execFile);

const REPO = "thara0402/tailspin-toys";

// Curated triage ranking. Curated (not derived from labels/dates — this repo's
// issues carry neither) by looking at blast radius and overlap risk across the
// open backlog. Kept separate from the live `gh issue list` data so the board
// still renders sensible copy even if an issue's title/body changes upstream;
// issue numbers no longer open are simply filtered out at render time.
const TOP_PRIORITY = [
    {
        number: 8,
        reason:
            "Foundational: this defines the comment/documentation conventions every other open issue's PR must follow. Landing it first avoids inconsistent reviews and rework across the rest of the backlog.",
    },
    {
        number: 7,
        reason:
            "Highest overlap risk: touches the same game-list page and src/lib data helpers as issues #1, #2, and #6, and is the most structurally complex (combinable multi-field filters). Sequencing it first reduces merge conflicts for the others.",
    },
    {
        number: 6,
        reason:
            "Changes the shape of the game-list data helpers (page/limit or cursor) that sorting and filtering will need to compose with. Landing pagination first gives the remaining list-page issues a stable contract to build against.",
    },
];
const TOP_NUMBERS = new Set(TOP_PRIORITY.map((p) => p.number));

async function fetchOpenIssues() {
    const { stdout } = await execFileAsync(
        "gh",
        [
            "issue",
            "list",
            "--repo",
            REPO,
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "number,title,body,url,createdAt,labels,assignees",
        ],
        { maxBuffer: 10 * 1024 * 1024 },
    );
    return JSON.parse(stdout);
}

function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function summarize(body, max = 220) {
    const text = String(body ?? "")
        .replace(/[#>*_`-]/g, "")
        .replace(/\r?\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > max ? text.slice(0, max).trimEnd() + "…" : text || "No description provided.";
}

function issueCard(issue, reason) {
    const labels = (issue.labels || []).map((l) => `<span class="label">${escapeHtml(l.name)}</span>`).join("");
    return `
    <article class="card${reason ? " top" : ""}" data-testid="issue-card-${issue.number}">
      <header>
        <a class="num" href="${issue.url}" target="_blank" rel="noopener">#${issue.number}</a>
        <h3>${escapeHtml(issue.title)}</h3>
      </header>
      <p class="desc">${escapeHtml(summarize(issue.body))}</p>
      ${labels ? `<div class="labels">${labels}</div>` : ""}
      ${reason ? `<p class="reason"><strong>Why now:</strong> ${escapeHtml(reason)}</p>` : ""}
      <button class="add-btn" data-number="${issue.number}" data-testid="add-to-context-${issue.number}">Add to context</button>
      <span class="status" data-testid="status-${issue.number}"></span>
    </article>`;
}

function renderHtml(instanceId, topCards, restCards) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Kanban Triage</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    margin: 0;
    padding: 1.5rem;
  }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin: 2rem 0 .75rem; }
  .sub { color: #94a3b8; font-size: .875rem; margin: 0 0 1rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: .5rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: .5rem;
  }
  .card.top { border-color: #f59e0b; box-shadow: 0 0 0 1px #f59e0b33; }
  .card header { display: flex; align-items: baseline; gap: .5rem; }
  .card h3 { font-size: .95rem; margin: 0; }
  .num { color: #60a5fa; text-decoration: none; font-weight: 600; font-size: .85rem; }
  .num:hover { text-decoration: underline; }
  .desc { font-size: .85rem; color: #cbd5e1; margin: 0; }
  .reason { font-size: .8rem; color: #fbbf24; background: #422006; border-radius: .375rem; padding: .5rem; margin: 0; }
  .labels { display: flex; flex-wrap: wrap; gap: .25rem; }
  .label { font-size: .7rem; background: #334155; padding: .1rem .5rem; border-radius: 999px; }
  .add-btn {
    align-self: flex-start;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: .375rem;
    padding: .4rem .75rem;
    font-size: .8rem;
    cursor: pointer;
  }
  .add-btn:hover { background: #1d4ed8; }
  .add-btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
  .add-btn:disabled { background: #475569; cursor: default; }
  .status { font-size: .75rem; color: #4ade80; }
  .empty { color: #94a3b8; font-size: .875rem; }
</style>
</head>
<body>
  <h1>Issue Triage Board</h1>
  <p class="sub">${escapeHtml(REPO)} — open issues, refreshed on load. Instance: ${escapeHtml(instanceId)}</p>

  <h2>🔥 Needs attention now</h2>
  <div class="grid" data-testid="top-priority-section">
    ${topCards.length ? topCards.join("") : '<p class="empty">Nothing flagged.</p>'}
  </div>

  <h2>📋 Backlog</h2>
  <div class="grid" data-testid="backlog-section">
    ${restCards.length ? restCards.join("") : '<p class="empty">No other open issues.</p>'}
  </div>

<script>
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.add-btn');
    if (!btn) return;
    const number = btn.dataset.number;
    const statusEl = document.querySelector('[data-testid="status-' + number + '"]');
    btn.disabled = true;
    btn.textContent = 'Adding…';
    try {
      const res = await fetch('/api/add-to-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });
      if (!res.ok) throw new Error(await res.text());
      btn.textContent = 'Added ✓';
      statusEl.textContent = 'Sent to session';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Add to context';
      statusEl.textContent = 'Failed — try again';
      statusEl.style.color = '#f87171';
    }
  });
</script>
</body>
</html>`;
}

// One local HTTP server per open canvas instance. Each instance gets its own
// ephemeral port so multiple canvases (or multiple opens of the same canvas)
// don't collide.
const servers = new Map();

async function buildPage(instanceId) {
    const issues = await fetchOpenIssues();
    const byNumber = new Map(issues.map((i) => [i.number, i]));
    const topCards = TOP_PRIORITY.filter((p) => byNumber.has(p.number)).map((p) => issueCard(byNumber.get(p.number), p.reason));
    const restCards = issues.filter((i) => !TOP_NUMBERS.has(i.number)).map((i) => issueCard(i));
    return renderHtml(instanceId, topCards, restCards);
}

async function startServer(instanceId, session) {
    const server = createServer(async (req, res) => {
        try {
            if (req.method === "GET" && req.url === "/") {
                const html = await buildPage(instanceId);
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(html);
                return;
            }
            if (req.method === "POST" && req.url === "/api/add-to-context") {
                let body = "";
                for await (const chunk of req) body += chunk;
                const { number } = JSON.parse(body || "{}");
                const issues = await fetchOpenIssues();
                const issue = issues.find((i) => i.number === Number(number));
                if (!issue) {
                    res.statusCode = 404;
                    res.end("Issue not found");
                    return;
                }
                const prioritized = TOP_PRIORITY.find((p) => p.number === issue.number);
                const prompt = [
                    `Let's work on GitHub issue #${issue.number}: ${issue.title}`,
                    `URL: ${issue.url}`,
                    prioritized ? `Why it's top priority: ${prioritized.reason}` : undefined,
                    "",
                    issue.body || "(no description provided)",
                ]
                    .filter((line) => line !== undefined)
                    .join("\n");
                await session.send(prompt);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                return;
            }
            res.statusCode = 404;
            res.end("Not found");
        } catch (err) {
            res.statusCode = 500;
            res.end(String(err && err.message ? err.message : err));
        }
    });
    // Port 0 = let the OS pick a free ephemeral port. Bind to loopback only.
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "kanban-triage",
            displayName: "Issue Triage Board",
            description: "Kanban-style board of open GitHub issues, highlighting the three most urgent with justification and a button to add any issue to this session's context.",
            actions: [
                {
                    name: "refresh",
                    description: "Re-fetch open issues and re-render the board",
                    handler: async () => ({ ok: true }),
                },
            ],
            // Called when the agent or host opens the canvas. We boot a local
            // HTTP server on an ephemeral port and hand its URL back to the
            // host so it can render the canvas. Re-opens with the same
            // instanceId reuse the existing server.
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId, session);
                    servers.set(ctx.instanceId, entry);
                }
                return {
                    title: "Issue Triage Board",
                    url: entry.url,
                };
            },
            // Tear the per-instance server down when the canvas is closed so
            // ports are not leaked across the lifetime of the extension.
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
