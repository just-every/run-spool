# Maintenance plan

Author: Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool. Product branch: cloud/gr-mt-spool-dep-11.

1. Initialize fleet identity, credential helper and preserving commit hooks; clone only the declared repository and read launcher/repository instructions.
2. Confirm the vulnerable dependency and its runtime artifacts. Change the exact rustls dependency from 0.23.45 to the minimum patched 0.23.46, use Cargo 1.90.0 to update only rustls, and retain all other crate versions.
3. Use Node 22.20.0, pnpm 10.12.4, Rust 1.90.0, wasm-bindgen 0.2.114 and LLVM 21.1.8. Perform frozen installation and noninteractive local setup. Rebuild production and test WASM and generated trust metadata; update TLS provenance documentation. Reproduce both binaries byte for byte.
4. Run only the existing affected loopback TLS delivery journey plus TypeScript typecheck and application build. Add no literal-version tests. Regenerate the source lock last and run source:check. Keep contract judgments and generated acceptance views unchanged.
5. Fetch current main and reconcile before publication; inspect every candidate commit identity/message, run Base's packaged publication scanner on the exact committed tree with environment comparison, require COMPLETE/PASS and zero findings, then push only the named cloud branch through the shared guard.
6. Discover and poll exact-SHA Verify using gh REST, with at most ten GitHub calls and at least 300 seconds between checks of a run. Fix in-scope failures if possible without rewriting published history.
7. Save actual result, check receipts and a non-secret report; publish the explicitly selected packet to the separate evidence ref. Return exact product/evidence custody and lane POST lines. The fleet owns landing; no main push or PR is needed unless repository instructions require it.
