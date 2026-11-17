# Hoglet

Hoglet is a local TypeScript MCP prototype for reading and editing existing
HedgeDoc notes. It exposes `read_note`, `get_note_info`, and `edit_note` over
stdio. Basic authenticated acceptance passed on disposable HedgeDoc **1.10.3**
and **1.12.0** instances. Real GitHub login and the complete compatibility matrix
remain pending; see the
[delivery evidence](book/implementation-roadmaps/delivery.md#hoglet-delivery-2-evidence).

Development follows the [Anchor Book methodology](https://github.com/anchor-book/anchor-book).
The [Book](book/SUMMARY.md) defines the intended system; tests and the roadmap
record actual coverage. AI agents start at [AGENTS.md](AGENTS.md).

## Build and run

Use Node **24.15.0** and npm **11.12.1**:

```sh
npm ci
npm run build
export HOGLET_SERVICE=https://hedgedoc.nikomatsakis.com
export HOGLET_RELEASE=1.10.3
```

`HOGLET_SERVICE` accepts an origin and optional deployment prefix, such as
`https://example.test/pad/`. Each process targets one service. The exact release
profile chooses the Socket.IO client and is checked before editing; unknown
releases fail rather than trying writes with different protocols.
The prototype requires WebSocket support; polling fallback is disabled.

For browser-assisted login, open `/me` on your already signed-in HedgeDoc site
and copy its `id` field. This is a HedgeDoc user ID, not a GitHub handle.
Then, from a graphical desktop:

```sh
npx playwright install chromium
node dist/src/cli.js login --user-id YOUR_HEDGEDOC_USER_ID
```

Complete the service's normal GitHub login in the dedicated Chromium window.
Hoglet verifies `/me` against the chosen ID and saves only the HedgeDoc session.
The login window times out after five minutes. This workspace has no graphical
display; browser provisioning was tested headlessly with a synthetic service,
not with a GitHub account.

For development, put exactly one `connect.sid=...` cookie in an owner-only file
using a local editor, then import it:

```sh
chmod 600 /path/to/protected-cookie-file
node dist/src/cli.js import-session --user-id YOUR_HEDGEDOC_USER_ID \
  --file /path/to/protected-cookie-file
```

Import also accepts piped stdin. Never place the cookie value in command-line
arguments, MCP configuration, a note tool, or repository files. Remove the
temporary import file when finished. Both acquisition paths validate the same
identity. `HOGLET_COOKIE_NAME` selects a custom service cookie name if needed.

The default store is `~/.local/share/hoglet/<service-fingerprint>/session.json`,
with a mode-700 parent and mode-600 file. `HOGLET_SESSION_FILE` can select another
protected location. Permissive session paths and symlinks are refused.
`node dist/src/cli.js logout` removes the local session; it does not revoke
other browser sessions. Running processes detect local logout before the next
authenticated call. Restart after provisioning a different user.
Each authenticated call revalidates `/me`.

Launch with `node dist/src/cli.js serve`. Stdout is reserved for MCP.
For permitted public reads without a session, set `HOGLET_ANONYMOUS=1`.
That mode cannot edit.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "hoglet": {
      "command": "node",
      "args": ["/absolute/path/to/hoglet/dist/src/cli.js", "serve"],
      "env": {
        "HOGLET_SERVICE": "https://hedgedoc.nikomatsakis.com",
        "HOGLET_RELEASE": "1.10.3"
      }
    }
  }
}
```

## Note tools

Use one editor note identifier or alias: letters/digits/underscore/hyphen first,
followed by letters, digits, underscore, hyphen, dot or space, up to 200
characters. URLs, paths, percent escapes, and published `/s/...` forms are
unsupported. All tools share this grammar.

`read_note({ "note": "my-note" })` returns raw persisted Markdown, a scoped
`snapshot`, and `source: "persisted"`. The database can lag live editors.
`get_note_info` returns title, nullable description, view count and timestamps.
Neither timestamps nor metadata authorize editing.

Pass the returned token to `edit_note`:

```json
{
  "note": "my-note",
  "expected_snapshot": "sha256:...token returned by read_note...",
  "edits": [{ "old_text": "old phrase", "new_text": "new phrase" }]
}
```

Each old phrase must appear exactly once. A batch resolves against one live
base and must not overlap. Insertions use unique surrounding text; an empty
old phrase only inserts into an empty document. Empty batches, invalid Unicode
and NUL input are rejected. No-op batches submit nothing.

The tool checks stale content before sending one UTF-16 OT operation.
Changes arriving during submission are collaboratively transformed; this
cannot provide an atomic content precondition or guarantee the prose intent
of overlapping edits.

Results include `outcome`, `submitted`, `acceptance`, `persistence`,
`concurrency_observed`, and observed content/snapshots when defensible:

| Outcome | Meaning |
| --- | --- |
| `unchanged` | Checked no-op; nothing sent |
| `stale-snapshot` | Live content differs; nothing sent |
| `rejected` | Preflight or validation failed before submission |
| `accepted` | Named ack received; persistence not observed |
| `persisted-observed` | Named ack plus matching database-backed readback |
| `uncertain` | Possibly submitted; acceptance unconfirmed |

Results use both MCP text content and `structuredContent`. Stale, rejected,
accepted-without-persistence, uncertain, and service-error results set
`isError: true`. Re-read and reconcile uncertain writes; Hoglet never replays
or rolls them back. Cancellation ends local observation, not a write. MCP
suppresses the canceled request's reply; Hoglet retains a nonsecret outcome
classification on stderr.

Defaults are a 15-second overall deadline, 4 seconds each for connection,
ack and persistence observation, a 1 MiB UTF-8 content limit, and 128
replacements. Queue waiting counts toward the overall deadline. Override
`HOGLET_CALL_MS`, `HOGLET_CONNECT_MS`, `HOGLET_ACK_MS`, `HOGLET_PERSIST_MS`,
or `HOGLET_MAX_BYTES` within the configured upper bounds.
Shutdown has a 2-second grace period, configurable with `HOGLET_SHUTDOWN_MS`.

Creation, history, deletion, permissions, resources, prompts and remote MCP
transport are outside this prototype.

## Verification

```sh
npm run typecheck
npm test
npm run check:criteria
npx playwright install chromium
npm run test:browser
```

The normal suite skips the browser case unless `HOGLET_BROWSER_TEST=1`;
`test:browser` enables it. It exercises actual Chromium login/session
export against synthetic authentication, not GitHub.
The [criterion map](verification/criteria.json) declares scope and gaps.

To repeat real-service checks, start a disposable instance bound to localhost:

```sh
docker run --detach --rm --name hoglet-test-1103 \
  --publish 127.0.0.1:43103:3000 \
  --env CMD_DB_URL=sqlite:///tmp/hoglet.sqlite \
  --env CMD_DOMAIN=localhost --env CMD_URL_ADDPORT=true \
  --env CMD_PROTOCOL_USESSL=false --env CMD_ALLOW_EMAIL_REGISTER=true \
  --env CMD_SESSION_SECRET=hoglet-disposable-fixture-session-key \
  --env CMD_ALLOW_ANONYMOUS=false quay.io/hedgedoc/hedgedoc:1.10.3
HOGLET_SERVICE=http://127.0.0.1:43103 HOGLET_RELEASE=1.10.3 npm run test:service
docker stop hoglet-test-1103
```

Wait for HTTP startup before acceptance. Repeat with release `1.12.0` and
another localhost port. The script creates a disposable email account and
note, imports its session, and exercises MCP tools, a second editor and
database readback. It rejects non-loopback destinations. This is test setup,
not an upgrade or production deployment recommendation.

Book tooling remains pinned independently of the Node runtime:

```sh
target/tools/bin/anchorbook check --config anchorbook.toml
PATH="$PWD/target/tools/bin:$PATH" target/tools/bin/mdbook build
```

See [Working on Hoglet](book/working-on-hoglet.md) for installation.
The API investigation is [here](research/hedgedoc-v1-api-deep-dive.md), and
OT provenance is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
