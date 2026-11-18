# Working on Hoglet

This chapter owns repository guidance: setup, commands, reference material,
and contribution workflow. The engine's `contract` command owns the reusable
AI Working Contract.

## Phase and layout

Read the current phase from `[project].phase` in `anchorbook.toml`; do not infer
it from unfinished code or draft records. The repository begins in Prototyping.
The engineer directs subsequent phase transitions.

| Path | Purpose |
| --- | --- |
| `src/` | Shared operations, CLI/MCP, HTTP, session, login and realtime implementation |
| `test/` | Independent expectations, service fixtures and actual-process tests |
| `scripts/` | Criterion mapping and disposable real-service acceptance |
| `verification/` | Project-owned TypeScript criterion associations and scope |
| `book/` | Authored Book; `SUMMARY.md` inventories every chapter |
| `anchorbook.toml` | Phase, Book paths, and section roles |
| `book.toml` | mdBook configuration and Anchor Book preprocessor |
| `research/` | Source-backed investigations; recommendations are not accepted design |
| `target/tools/` | Repository-local development tools, ignored by Git |
| `target/anchorbook/` | Rendered Book, ignored by Git |

## Tool setup

Pin Anchor Book to commit `9689b00416fd577bfb68a02f1fa310f6088404cf`
(package version 0.1.0), and mdBook to 0.5.4, the renderer version that engine
supports. Run setup from this repository root:

```sh
cargo install --git https://github.com/anchor-book/anchor-book \
  --rev 9689b00416fd577bfb68a02f1fa310f6088404cf \
  --locked --root target/tools anchor-book
cargo install mdbook --version 0.5.4 --locked --root target/tools
target/tools/bin/anchorbook --version
target/tools/bin/mdbook --version
```

For the engineer's local clone at `~/dev/anchor-book`, first confirm that
`git rev-parse HEAD` returns the pinned commit and `git status --porcelain` is
empty. Then this installation is an equivalent source option:

```sh
cargo install --path ../anchor-book --debug --locked \
  --root target/tools --target-dir target/anchor-book-engine
```

Check the engine's reported revision against the pin before using it. Its
schema 1 implementation does not support an `[engine]` version field or
automatically enforce this pin; contributor setup owns that check.

Use Node 24.15.0 and npm 11.12.1 for the prototype. `.node-version`, the package
engine range and package-manager field record those versions; the package's
Volta settings select them for contributors using its shims. `package-lock.json`
pins dependency archives. Run `npm ci` and `npm run build` from the root.
Version files do not switch a terminal that resolves Node outside those shims.
If an existing shell still uses Node 18, invoke
`"$HOME/.volta/bin/volta" run --node 24.15.0 --npm 11.12.1 npm run auth SERVER`,
or place `$HOME/.volta/bin` first in `PATH` and refresh command lookup.
The CLI checks the supported Node range before importing Playwright and reports
an actionable runtime error when it does not match.
TypeScript is 7.0.2, MCP SDK 1.32.2, and the negotiated prototype MCP revision
is 2025-11-25. The SDK is the maintained v1 line; adopting the newer MCP revision
and SDK packages requires separate compatibility work rather than an untested upgrade.
Socket.IO clients are 2.5.0 (npm alias `socket.io-client-v2`) and 4.8.4.
The exact experimental service profiles are 1.10.3 and 1.12.0.
`ot` 0.0.15 supplies the upstream-compatible text operation; provenance and
its MIT notice are in `THIRD_PARTY_NOTICES.md`. Playwright 1.65.1 supplies
the dedicated login browser. The runtime no longer contains the Rust scaffold.
`@napi-rs/keyring` 2.1.2 supplies native macOS Keychain access; the npm lockfile
also pins its platform binaries. Other platforms and explicit development
configuration use protected files.
Anchor Book remains a Rust development tool: it requires Rust 1.88 or newer;
the initial adoption is checked with Rust 1.97.0.

## Supported commands

Run commands from the repository root:

```sh
target/tools/bin/anchorbook contract
target/tools/bin/anchorbook check --config anchorbook.toml
PATH="$PWD/target/tools/bin:$PATH" target/tools/bin/mdbook build
npm run typecheck
npm test
npm run check:criteria
npm run build
```

`./install.sh` builds an independent local distribution with its own verified
Node 24.15.0 and npm 11.12.1, without requiring system Node/npm. The default
launcher is `~/.local/bin/hoglet`; `--prefix /absolute/path` selects another
installation prefix. It includes locked production dependencies and installs
Chromium in the per-user cache; `--skip-browser` defers that step to
`hoglet install-browser`. Updates rerun the same command and retain earlier
releases. Session settings and Keychain credentials remain outside the
distribution. See `README.md` for MCP paths and recovery instructions.

For local browser authentication, install Chromium
with `npx playwright install chromium`, and run `npm run auth SERVER`. This builds the
checkout, opens the service login flow, and discovers the signed-in user through
`/me`. The installed executable exposes the same workflow as `hoglet auth SERVER`;
optional `--user-id ID` checks a specific account. Bare hostnames use HTTPS;
full HTTP(S) URLs support deployment prefixes. Authentication without a server
argument uses `HOGLET_SERVICE`. Per-service metadata persists under
`XDG_DATA_HOME`, defaulting to `~/.local/share/hoglet/`. macOS credentials live
in the login Keychain; `HOGLET_CREDENTIAL_STORE=file` selects protected-file
storage for development. Loading existing protected files migrates them to
Keychain on macOS after verified storage, unless file storage is selected.
Bare `hoglet` prints concise command help and exits. `hoglet skill` prints local
LLM workflow instructions, including user authentication and saved-session reuse.
`hoglet mcp` starts one stdio process that
discovers saved services through `list_services` and accepts a service on each
note call. `mcp SERVER` provides an optional default; `serve` remains an alias.

The same application operations are available as `hoglet services`,
`hoglet read NOTE [--service SERVER] [--json]`, `hoglet info NOTE
[--service SERVER]`, and `hoglet edit NOTE [--service SERVER] --snapshot TOKEN
--edits FILE`. Edits accept a JSON replacement array from a file or stdin
(`--edits -`). Raw reads preserve Markdown exactly; JSON reads include the
snapshot required for editing. These commands reuse saved Keychain/XDG
sessions and the service selection and write classifications defined in
[System Overview](design/system-overview.md#cli-note-operations). See `README.md`
for examples and exit statuses.

The structural check validates configured paths, navigation, section roles,
and renderer alignment. The Book build additionally validates typed records,
authority references, roadmap syntax, and anchor coverage references through
the preprocessor. Neither check verifies the server's intended behavior.
Inspect rendered records and affected links after Book changes.

`npm test` compiles and runs native Node tests, including actual CLI/stdio
processes, HTTP and both Socket.IO generation fixtures. CLI cases cover
file/stdin input, exact output, saved-service selection, stale/uncertain writes,
deadlines and process signals. Its optional browser cases are
skipped unless enabled. Install Chromium with `npx playwright install chromium`
and run `npm run test:browser` to exercise the actual provisioning/export code
against synthetic authentication. A graphical desktop and user participation
are needed for a real GitHub login; this test does not supply that evidence.
`npm run test:keychain` runs controlled storage failures and, on macOS, an
actual CLI/MCP/native-Keychain case using temporary synthetic entries that
the test removes. The normal suite skips native Keychain access unless
`HOGLET_KEYCHAIN_TEST=1`; its controlled storage cases still run.
`npm run test:standalone` runs the actual shell installer, relocates its output,
and exercises installed browser/auth, note CLI and stdio MCP with unavailable or legacy
system Node/npm. It needs network/cache access and a graphical desktop and
removes its temporary native credentials. `HOGLET_NODE_ARCHIVE` can supply the
official cached runtime archive (still checksum-verified), and
`HOGLET_LEGACY_NODE` can select an actual Node 18 executable for this check.

`npm run check:criteria` validates the project-owned mapping against every
Book criterion and checks source/case references. It is association validation,
not evidence execution. `npm run test:service` exercises disposable loopback
HedgeDoc using the explicitly configured `HOGLET_SERVICE` and `HOGLET_RELEASE`.
It creates test accounts and notes, rejects non-loopback destinations, and
prints no credential values. Setup and local CLI commands are in `README.md`.
There is no CI or native engine behavioral-evidence adapter yet.
Do not describe `anchorbook verify` as configured for Hoglet: no verification
runners or source associations have been set up.

## Authoring references

Use the references from the pinned Anchor Book revision, available under
`~/dev/anchor-book` after checking its revision, or from the source links:

- [Anchor and criterion syntax](https://github.com/anchor-book/anchor-book/blob/9689b00416fd577bfb68a02f1fa310f6088404cf/book/design/anchor-definitions.md)
- [Requirement and decision syntax](https://github.com/anchor-book/anchor-book/blob/9689b00416fd577bfb68a02f1fa310f6088404cf/book/design/authority-definitions.md)
- [Roadmap format, coverage, and evidence](https://github.com/anchor-book/anchor-book/blob/9689b00416fd577bfb68a02f1fa310f6088404cf/book/implementation-roadmaps/index.md)
- [Configuration](https://github.com/anchor-book/anchor-book/blob/9689b00416fd577bfb68a02f1fa310f6088404cf/book/design/configuration.md)

Some upstream chapters describe future capabilities. The pinned implementation
supports schema 1 with the three required section roles. RFD support is not
enabled or implemented in that schema; use ordinary design review.

## HedgeDoc reference

The engineer's reference clone is `~/dev/hedgedoc`. The initial Book draws on
the clean checkout at commit `dbb71bae523af1dfba30006e4922143d8004f741`,
whose `package.json` identifies version 1.12.2. Source files relevant to this
Book are `docs/content/dev/api.md`, `docs/content/dev/openapi.yml`,
`lib/web/note/{router,controller,util,actions}.js`, `lib/web/historyRouter.js`,
`lib/web/userRouter.js`, `app.js`, and the editing events in `lib/realtime.js`.
The read/edit investigation also examines `lib/web/auth/github/index.js`,
`lib/web/auth/utils.js`, `lib/permissions.js`, `lib/ot/`, and the browser OT
adapters under `public/vendor/ot/`.

Read the release-specific source as well as the development checkout. The local
clone contains the 1.10.3 tag at
`d8b94026ee927213eda14973dd4386ea9e6389c0`, relevant to the example deployments.
Use `git show <tag>:<path>` to inspect it without changing the reference checkout.
Milestone 4 records deployment observations and version-sensitive findings;
the research report is `research/hedgedoc-v1-api-deep-dive.md`.

Use documentation to locate an interface and source to assess its behavior.
A source review against this checkout does not establish compatibility with
all 1.x releases. Record tested releases and instance settings in milestone
evidence. Reference clones are development inputs, not runtime dependencies.

## Contribution workflow

Read the contract and every Book chapter, then check structure at session start.
State assigned scope before making changes. The bootstrap assignment establishes
the methodology. The engineer has also assigned a subagent investigation of
reading and editing under GitHub-authenticated HedgeDoc sessions; this work is
recorded separately from server implementation. The engineer's "please prototype"
assigns milestone 2; use its draft design for scoped experiments, preserve
accepted product choices, and record results and remaining acceptance gaps.

Requirements and decisions explicitly supplied by the engineer are accepted,
including TypeScript, concurrent merging, browser-assisted login with development
import, and dual-transport support. Inferred requirements,
transport and tool choices, and anchors remain draft until review.
Keep unresolved product choices in the relevant proposed milestone or assigned
experiment. Reconcile design, authority, anchors, and affected roadmap work in
one change before implementing revised behavior.

Record tests and evidence with the code and design they assess. Before entering
Building, agree on the test, mutation, CI, compatibility, and contribution
workflow described by the contract. Run Book checks for documentation changes;
do not invent behavioral tests for unchanged implementation.

Inspect changes before any authorized publication. Do not put deployment
credentials, session cookies, real private notes, or private reference material
in the Book, fixtures, or generated output intended for publication. Use
synthetic examples and locally controlled test services.
