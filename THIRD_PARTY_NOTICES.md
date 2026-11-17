# OT provenance

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
