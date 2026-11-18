# Third-party notices

## Private Node distribution

The standalone installer downloads the official Node.js **24.15.0** archive
for the host, verified against the SHA-256 pins in `install.sh` from that
release's `SHASUMS256.txt`. It retains the archive's `LICENSE` at
`runtime/LICENSE`, including Node and its bundled dependency notices, and the
bundled npm **11.12.1** license files. Application production dependencies stay
in `app/node_modules/` with their packaged notices, including the Keychain
platform binary's `LICENSE.third-party.md`. No Node source is copied into
Hoglet's source tree.

## OT provenance

Hoglet depends on the published `ot` package, version **0.0.15**, from
Tim Baumann's `operational-transformation/ot.js`. It imports `TextOperation`
for compilation, application and transformation. It does not use the package's
editing client or its reconnect/resend behavior.

The installed `lib/text-operation.js` SHA-256 is
`5b757d243692272f446db55f59f5b256b67b1a5faf5f30093ae1ec2e24cba935`.
It is byte-identical to `lib/ot/text-operation.js` in HedgeDoc 1.10.3
(`d8b94026ee927213eda14973dd4386ea9e6389c0`) and 1.12.0
(`b9335040716278d029b5872e3825b92821d9cb70`).
The npm lockfile pins package archive integrity. No HedgeDoc server code
is copied into Hoglet.

The OT package's MIT notice follows:

Copyright © 2012-2014 Tim Baumann, http://timbaumann.info

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## macOS Keychain adapter

Hoglet imports the published `@napi-rs/keyring` **2.1.2** adapter and its
matching platform binary; archive integrity is pinned in `package-lock.json`.
On macOS its native Apple backend uses the User (login) Keychain. Hoglet
does not copy the adapter or its Rust implementation into its source.
The native package ships `LICENSE.third-party.md` for the bundled Rust
dependencies; preserve that file when redistributing its binary.

The adapter's MIT notice follows:

MIT License

Copyright (c) 2020 N-API for Rust

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
