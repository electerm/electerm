# Vendored ironrdp-wasm build

The npm package `ironrdp-wasm` 1.1.0 was replaced by this locally built copy
because of three RDP responsiveness fixes that live in the IronRDP web
session loop (crates/ironrdp-web/src/session.rs of Devolutions/IronRDP):

1. **Input drain** — the session main loop used to process a single input
   event batch per iteration. When the RDP server floods the client with
   frame updates (e.g. a terminal scrolling fast), input events starved
   behind the graphics pipeline and mouse/keyboard appeared frozen. The
   input branch now drains every already-queued event in one iteration.
2. **Draw throttling** — every graphics update was painted immediately.
   Updates are now coalesced into one dirty rectangle, painted by a ~60fps
   flush ticker, so a screen-update flood cannot monopolize the main thread.
3. **`enable_server_pointer` extension** — the `extension()` builder method
   now accepts `enable_server_pointer`; electerm passes `false` so the mouse
   cursor is rendered locally (immediate cursor feedback, no round-trip
   through the update pipeline).

Plus a proxy-side speedup (not part of the wasm): `src/app/server/rdp-proxy.js`
uses Node's native `tls` instead of pure-JS node-forge.

## Rebuild

Prerequisites: rustup (with the `stable-x86_64-pc-windows-gnu` toolchain —
no MSVC needed), the `wasm32-unknown-unknown` target and wasm-pack.

```bash
# 1. Clone Devolutions/IronRDP and checkout the pinned snapshot
git clone https://github.com/Devolutions/IronRDP.git ../IronRDP
cd ../IronRDP && git checkout d0e18e3693f313e83c769fb37fa991965d2a39d3

# 2. Apply this patch
git apply /path/to/electerm/src/build/vendor/ironrdp-wasm/ironrdp-web-session.patch

# 3. Build the wrapper crate (clone https://github.com/electerm/ironrdp-wasm);
#    its Cargo.toml [patch] section points at the local IronRDP checkout
cd ../ironrdp-wasm
RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu wasm-pack build --target web --out-dir pkg --release

# 4. Copy the result here
cp -r pkg/* /path/to/electerm/src/build/vendor/ironrdp-wasm/pkg/
```

The client resolves `ironrdp-wasm` to `pkg/rdp_client.js` through the vite
alias in `src/build/vite/conf.js`.
