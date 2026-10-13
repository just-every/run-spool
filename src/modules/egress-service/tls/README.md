# TLS provenance and builds

Production `egress.wasm` is built from [src/lib.rs](src/lib.rs) with Rust **1.90.0**, the
`wasm32-unknown-unknown` target, wasm-bindgen **0.2.114**, and LLVM clang/llvm-ar
**21.1.8**. `Cargo.lock` fixes every transitive crate. The direct TLS inputs are
[rustls 0.23.45](https://docs.rs/rustls/0.23.45/rustls/),
[ring 0.17.14](https://docs.rs/ring/0.17.14/ring/), and
[webpki-roots 1.0.9](https://docs.rs/webpki-roots/1.0.9/webpki_roots/).
The roots crate compiles its Mozilla trust-anchor snapshot into the module;
root updates require a reviewed dependency update, rebuild and verification.
No operating-system or runtime-added trust anchors are used in production.

Rustls uses its standard WebPKI server verifier and original `ServerName`, with
SNI enabled and “http/1.1” ALPN. It verifies the chain, validity period and name.
The TLS engine has no custom verifier, verification bypass, native TLS upgrade
or destination-fetch path. Ring's getrandom JavaScript path uses Worker Web Crypto
`getRandomValues`; wasm-bindgen supplies the generated imports. The explicit
`TimeProvider` calls `Date.now()` and refuses an invalid timestamp. A separate
WASM instance and generated-import closure belongs to each connection.

The bridge caps input/output scratch space at 64 KiB, application writes at
16 KiB, cumulative handshake input at 256 KiB and WASM linear memory at 16 MiB.
Rustls additionally bounds TLS records and handshake messages. It authenticates
the handshake before HTTP bytes are written. HTTP body/head limits and the
whole-exchange deadline remain in the transport. Close-delimited responses
require an authenticated TLS close notification; raw TCP truncation fails.
Abort closes late sockets, cancels raw streams and releases their locks.

Install the declared Rust toolchain/target and wasm-bindgen CLI, and put the
specified LLVM `clang` and `llvm-ar` on PATH. From the repository root:

```sh
rustup toolchain install 1.90.0 --profile minimal --target wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.114 --locked --jobs 2
nice -n 15 node modules/egress-service/tls/build.mjs
nice -n 15 node modules/egress-service/tls/build.mjs --test
nice -n 15 node modules/egress-service/tls/build.mjs --check
```

`--check` compiles in a separate target directory and compares both production
WASM and glue byte for byte. Each build also regenerates `trust-bundle.json`:
the SHA-256 of `egress.wasm` and `test.wasm`, the locked webpki-roots release and
checksum, and the SHA-256 of every compiled anchor's subject Name and public key
DER, each confirmed present in the artifact. `--check` rejects a manifest that does
not match. Base's publication scan uses it to recognise the CA contact emails in
those anchors' subjects as public certificate metadata, and only there. The build rejects unresolved native imports and a
production root-injection export. Generated `engine.js` preserves the generated
crypto/clock imports, removes unused asynchronous asset loaders and wraps them
in a per-instance closure. Production loads the compiled static Worker module.
The packager checks again that no test-root export is present and uploads WASM
with “application/wasm” through deploy-kit.

`test.wasm` is separately compiled with `test-roots`, adding only the ability to
trust the test suite's temporary CA. Tests exercise the same verifier and real
TLS over loopback, including wrong-host, untrusted and expired certificates.
That binary is unreachable from the production import graph. Checked-in built
artifacts let ordinary Base verification and relocated edition checks run
without requiring a Rust toolchain. Rebuild verification is an explicit release
step; it is not a claim that every consumer's CI recompiles Rust.

Production WASM is **605,169 bytes**. The complete 12-module Worker is **645,795 bytes**, including **8,715 bytes** of
generated glue, as recorded with the OD08-1b evidence. Initial OD08-1b attempt 1 used
rustls 0.23.35/webpki-roots 1.0.4; subsequent qualification uses the versions
above. Byte reproducibility is demonstrated with the declared compiler toolchain,
not claimed across arbitrary LLVM versions.
