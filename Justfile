# permissionless.money — development & operations

set dotenv-load := false
set shell := ["bash", "-euo", "pipefail", "-c"]

# ── Development ────────────────────────────────────────────────────

# start dev server on :8001 (no-cache for rapid iteration)
serve:
    npx http-server . -p 8001 -c-1

# ── WASM ───────────────────────────────────────────────────────────

# build passkey-wasm crate → pkg/ (requires wasm-pack)
wasm-build:
    cd passkey-wasm && wasm-pack build --target web --release --out-dir ../pkg

# build oline-wasm crate → pkg/ (requires wasm-pack)
oline-wasm-build:
    cd oline-wasm && wasm-pack build --target web --release --out-dir ../pkg

# build svg-wasm crate → pkg/ (requires wasm-pack)
svg-wasm-build:
    cd svg-wasm && wasm-pack build --target web --release --out-dir ../pkg

# run Rust unit tests for all WASM crates
wasm-test:
    cd passkey-wasm && cargo test
    cd oline-wasm && cargo test
    cd svg-wasm && cargo test

# run JS lint + type check (add node --test when test files exist)
js-test: lint
    @echo "JS lint passed. Add node --test tests/*.test.js when test files are created."

# run all tests (WASM + JS)
test: wasm-test js-test

# ── Build ──────────────────────────────────────────────────────────

# full static build → dist/
build:
    mkdir -p dist
    node build.js

# full build including all WASM crates
build-all: wasm-build oline-wasm-build svg-wasm-build build

# ── IPFS ───────────────────────────────────────────────────────────

# add dist/ to local IPFS and show CID
ipfs:
    ipfs add -r dist/ --quieter

# build + pin to IPFS
deploy: build
    ipfs add -r dist/ --quieter

# ── Docker ─────────────────────────────────────────────────────────

# start nginx + minio via docker-compose
up:
    docker compose up -d

# stop docker-compose services
down:
    docker compose down

# rebuild docker image
docker-build:
    docker build -t permissionless-money .

# ── Validation ─────────────────────────────────────────────────────

# check all expected files exist
check:
    #!/usr/bin/env bash
    ok=0; fail=0
    for f in index.html mint.html oline.html svg-mint.html lib/auth.js lib/oline.js lib/svg-mint.js lib/queries.js lib/s3-upload.js lib/cw721-svg.js; do
        if [ -s "$f" ]; then
            echo "  ok  $f"
            ok=$((ok + 1))
        else
            echo "  MISSING  $f"
            fail=$((fail + 1))
        fi
    done
    if [ -d "pkg" ] && [ -s "pkg/passkey_wasm.js" ]; then
        echo "  ok  pkg/passkey_wasm.js (WASM built)"
        ok=$((ok + 1))
    else
        echo "  WARN  pkg/ not built (run: just wasm-build)"
    fi
    echo ""
    echo "$ok ok, $fail missing"
    [ "$fail" -eq 0 ]

# lint JS files
lint:
    npx eslint lib/ api/ *.js

# ── Utilities ──────────────────────────────────────────────────────

# remove build artifacts
clean:
    rm -rf dist pkg/passkey_wasm_bg.wasm pkg/passkey_wasm.js pkg/passkey_wasm.d.ts pkg/svg_wasm_bg.wasm pkg/svg_wasm.js pkg/svg_wasm.d.ts
    find . -name '.DS_Store' -delete

# show lines of code
loc:
    wc -l index.html mint.html oline.html svg-mint.html lib/*.js api/*.js passkey-wasm/src/lib.rs oline-wasm/src/lib.rs svg-wasm/src/lib.rs

default: check
