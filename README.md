# Hoglet

Hoglet is a local TypeScript prototype for reading and editing existing
HedgeDoc notes across multiple services through a CLI or MCP.
It exposes `list_services`, `read_note`, `get_note_info`, and `edit_note` over
stdio, with matching `services`, `read`, `info`, and `edit` commands.
Basic authenticated acceptance passed
on disposable HedgeDoc **1.10.3**
and **1.12.0** instances. Real GitHub login and the complete compatibility matrix
remain pending; see the
[delivery evidence](book/implementation-roadmaps/delivery.md#hoglet-delivery-2-evidence).

Development follows the [Anchor Book methodology](https://github.com/anchor-book/anchor-book).
The [Book](book/SUMMARY.md) defines the intended system; tests and the roadmap
record actual coverage. AI agents start at [AGENTS.md](AGENTS.md).

## Install with a private Node

From this checkout, run:

```sh
./install.sh
```

This downloads and verifies Node **24.15.0**, uses its npm **11.12.1** to
build an independent copy, and installs Chromium for login. It requires shell,
curl, tar and shasum or sha256sum; it does not use your system Node/npm.
The installation lives in `~/.local/lib/hoglet/`, with its launcher at
`~/.local/bin/hoglet`. You can move or remove the checkout afterward.
On Linux, Chromium's desktop libraries must already be available.
macOS ARM64 is the assessed host; macOS x64 and Linux ARM64/x64 are installer
targets that still need their own acceptance runs.

Run from any directory:

```sh
~/.local/bin/hoglet --version
~/.local/bin/hoglet auth hedgedoc.nikomatsakis.com
~/.local/bin/hoglet auth hedgedoc.symposium.dev
~/.local/bin/hoglet mcp
```

`hoglet` without arguments prints help and exits. `hoglet mcp [SERVER]`
starts the stdio MCP server; `serve` remains an alias.
Run `hoglet skill` for the LLM workflow: discover saved services, have the user
authenticate when needed, read before editing, and inspect write outcomes.
Valid saved sessions are reused; CLI commands can run directly without starting
an MCP server.

`--version` includes the actual Node version. The launcher uses the private
runtime even when your shell selects Node 18. Add `~/.local/bin` to your PATH
to use the short `hoglet` command; the installer does not edit shell startup
files. It preserves service/XDG settings and excludes host Node preload hooks
(`NODE_OPTIONS`, `NODE_PATH`).

Use `./install.sh --prefix /absolute/path` to install elsewhere.
`--skip-browser` defers Chromium setup; run `hoglet install-browser` later,
using the same private runtime. Browser files stay in Playwright's per-user
cache rather than the source checkout.

To update, rerun `./install.sh` from the updated checkout with the same prefix.
Only a completed build becomes the current release; earlier releases remain
under `lib/hoglet/releases/`. Credentials and metadata remain in the existing
Keychain/XDG store and are reused by the installed command. The installer
refuses to overwrite an unrelated `bin/hoglet`. If interrupted, check that no
installer is running before removing a stale `lib/hoglet/install.lock`.
For an offline runtime download, `HOGLET_NODE_ARCHIVE=/absolute/path/to/node.tar.gz`
selects an existing official archive; its pinned checksum is still verified.
Application dependencies and an uncached browser still require network access.

## Build and run

Use Node **24.15.0** and npm **11.12.1**:

```sh
npm ci
npm run build
```

If you use Volta, the checkout selects these versions automatically.
This requires Volta's shims to precede other Node installations in your `PATH`.
If a terminal still reports Node 18, select the pins explicitly:

```sh
"$HOME/.volta/bin/volta" run --node 24.15.0 --npm 11.12.1 \
  npm run auth hedgedoc.nikomatsakis.com
```

For subsequent commands in that terminal, put `$HOME/.volta/bin` first in
`PATH` and refresh the shell's command lookup. On zsh:

```sh
export PATH="$HOME/.volta/bin:$PATH"
rehash
node --version
```

An unsupported runtime fails before loading Playwright with Hoglet's Node
requirement and a command to select the pinned version.

Server arguments accept a hostname or HTTP(S) base URL with an optional
deployment prefix, such as `https://example.test/pad/`. Bare hostnames use
HTTPS. The exact release profile chooses the Socket.IO client and is checked
before editing; unknown
releases fail rather than trying writes with different protocols.
The prototype requires WebSocket support; polling fallback is disabled.

For browser-assisted login, run from a graphical desktop:

```sh
npx playwright install chromium
npm run auth hedgedoc.nikomatsakis.com
npm run auth hedgedoc.symposium.dev
```

Complete the service's normal GitHub login in the dedicated Chromium window.
Hoglet discovers your HedgeDoc user ID through `/me`, saves only the HedgeDoc
session, prints your verified ID and name, and closes the window. You do not
need to copy an ID or cookie. The login window times out after five minutes.
`npm run auth` builds the checkout before launching authentication. Each server
gets a separate saved session. You can close this terminal and use those
sessions later from the MCP process.

The executable command is `hoglet auth SERVER`. For development, `npm run build`
and `npm link` provide a command linked to this checkout using system Node;
the standalone installer above provides the independent private runtime.
You can also invoke it directly with
`node dist/src/cli.js auth SERVER`. To require a specific HedgeDoc account, use
`npm run auth -- SERVER --user-id YOUR_HEDGEDOC_USER_ID`. The existing
`login [SERVER] --user-id ID` command remains available.

Authentication defaults to release **1.10.3**. For the newer supported profile,
run `HOGLET_RELEASE=1.12.0 npm run auth SERVER`. `HOGLET_COOKIE_NAME` selects a
custom session cookie if needed. These settings are saved per server and reused
by MCP. Existing records without a saved profile use the configured release
and cookie name, defaulting to 1.10.3 and `connect.sid`.
`HOGLET_SERVICE` provides a default server when you omit the argument; an
explicit server argument overrides it.

For development, put exactly one `connect.sid=...` cookie in an owner-only file
using a local editor, then import it:

```sh
chmod 600 /path/to/protected-cookie-file
node dist/src/cli.js import-session SERVER --user-id YOUR_HEDGEDOC_USER_ID \
  --file /path/to/protected-cookie-file
```

Import also accepts piped stdin. Never place the cookie value in command-line
arguments, MCP configuration, a note tool, or repository files. Remove the
temporary import file when finished. Both acquisition paths validate the same
authenticated identity. Import requires the intended HedgeDoc ID, available
from `/me` in a signed-in browser.

On macOS, session cookies live in your login Keychain under the service
**Hoglet**. The native adapter passes credentials directly to Keychain; they
never enter subprocess arguments. A locked or denied Keychain returns an
error and does not fall back to plaintext storage. macOS may ask you to allow
the Node process access.

Nonsecret service metadata lives in `$XDG_DATA_HOME/hoglet/<service-fingerprint>/session.json`,
defaulting to `~/.local/share/hoglet/` when `XDG_DATA_HOME` is empty or relative.
Each service fingerprint includes its scheme, host, port and deployment prefix.
Directories are mode 700 and files mode 600. Keychain-backed files contain the
server URL, user ID, release, cookie name and a credential reference, with no
cookie values. Existing cookie files migrate when loaded on macOS, after
verifying the Keychain write. You can also re-run `hoglet auth SERVER`.
Other platforms retain protected-file credentials; set
`HOGLET_CREDENTIAL_STORE=file` explicitly for development. Existing
Keychain-backed records stay in Keychain even with that setting.
`HOGLET_SESSION_FILE` can select a custom protected file for an explicit default
service. Permissive session paths and symlinks are refused.
`hoglet logout SERVER` removes that server's Keychain item and metadata; it does
not revoke
other browser sessions. Running processes detect local logout before the next
authenticated call. Restart after provisioning a different user.
Each authenticated call revalidates `/me`.

Launch with `hoglet mcp`, `node dist/src/cli.js mcp` or `npm start`. One process accesses all
saved services and discovers new logins without restarting. Stdout is reserved
for MCP. `mcp SERVER` or `HOGLET_SERVICE` selects an optional default; otherwise
note calls must select a service when more than one is saved.
For permitted public reads without a session, select a default server and set
`HOGLET_ANONYMOUS=1`.
That mode cannot edit.

Example MCP client configuration:

```json
{
  "mcpServers": {
    "hoglet": {
      "command": "/Users/YOUR_USER/.local/bin/hoglet",
      "args": ["mcp"]
    }
  }
}
```

Use your actual absolute launcher path; MCP clients do not necessarily expand
`~` or inherit your terminal PATH. For a checkout-only setup, retain `node` and
the absolute `dist/src/cli.js` path.

## Note commands

The CLI reuses the same saved logins and note operations as MCP. After
`hoglet auth SERVER`, run:

```sh
hoglet services
hoglet read my-note --service hedgedoc.nikomatsakis.com
hoglet info my-note --service hedgedoc.nikomatsakis.com
hoglet read my-note --service hedgedoc.nikomatsakis.com --json > note.json
```

Use `~/.local/bin/hoglet` if the launcher is not on your PATH. From a checkout,
build first and replace `hoglet` with `node dist/src/cli.js`.
`--service` overrides `HOGLET_SERVICE`; if neither is set, Hoglet selects the
only saved service. Multiple saved services require a selection.
`services` lists nonsecret metadata without contacting the servers.

`read` prints the exact persisted Markdown, without adding a newline.
`read --json` returns Markdown, service, snapshot and source as JSON.
`info` and `edit` also return JSON. Note identifiers and replacement rules
are the same as the [MCP tools](#note-tools).

To edit, put a replacement array in `edits.json`:

```json
[{"old_text": "old phrase", "new_text": "new phrase"}]
```

Pass the `snapshot` from `note.json`:

```sh
hoglet edit my-note --service hedgedoc.nikomatsakis.com \
  --snapshot 'sha256:...token from note.json...' --edits edits.json
```

`--edits -` reads the array from piped stdin. Input has a finite size and
deadline. `--` ends option parsing for a note name beginning with `--`.
An edit requires a snapshot; a stale token submits nothing.

Exit status is 0 for successful reads/info/discovery or unchanged/persisted
edits, 1 for usage, service, rejected or stale errors, and 2 for an accepted
or uncertain edit whose persistence is unconfirmed. Classified edit results
remain on stdout even with a nonzero status; other failures return
`{"error":{"code":"...","message":"..."}}` on stderr.
SIGINT and SIGTERM exit with 130 and 143, preserving any observed edit
acknowledgement or uncertainty. Re-read and reconcile unconfirmed writes
before retrying; cancellation does not undo a submitted change.

## Note tools

`list_services({})` discovers saved service URLs, user IDs and release profiles.
It does not expose cookies or revalidate authentication. Each note tool accepts
a `service` hostname or base URL; only saved services can be selected.

Use one editor note identifier or alias: letters/digits/underscore/hyphen first,
followed by letters, digits, underscore, hyphen, dot or space, up to 200
characters. URLs, paths, percent escapes, and published `/s/...` forms are
unsupported. All tools share this grammar.

`read_note({ "service": "hedgedoc.nikomatsakis.com", "note": "my-note" })`
returns raw persisted Markdown, a scoped
`snapshot`, and `source: "persisted"`. The database can lag live editors.
`get_note_info` returns title, nullable description, view count and timestamps.
Neither timestamps nor metadata authorize editing.

Pass the returned token to `edit_note`:

```json
{
  "service": "hedgedoc.nikomatsakis.com",
  "note": "my-note",
  "expected_snapshot": "sha256:...token returned by read_note...",
  "edits": [{ "old_text": "old phrase", "new_text": "new phrase" }]
}
```

Successful note results identify their canonical service. Credentials, identities,
snapshots, transport profiles and edit queues remain separate for each service.

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
npm run test:keychain
npm run test:standalone
```

The normal suite exercises actual CLI and MCP processes against both transport
fixtures, including file/stdin edits, selection errors and cancellation.
It skips the browser cases unless `HOGLET_BROWSER_TEST=1`;
`test:browser` enables it. It exercises actual Chromium login/session
export, automatic ID discovery, expected-ID checks, anonymous responses and
storage failure against synthetic authentication, not GitHub.
The Keychain suite tests migration and storage failures with a controlled
adapter. `test:keychain` additionally creates temporary synthetic entries in
the macOS login Keychain, exercises actual CLI and MCP access, then removes them.
The [criterion map](verification/criteria.json) declares scope and gaps.
`test:standalone` runs the actual installer under an incompatible/unavailable
system Node/npm, relocates the installed tree, and exercises browser setup,
visible synthetic auth, native macOS Keychain, and two-service CLI/MCP reads/edits.
It needs network/cache access and a graphical desktop; it creates temporary
installations and credentials and removes them. Set `HOGLET_LEGACY_NODE` to
an actual Node 18 executable for the stronger runtime-selection check.

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
