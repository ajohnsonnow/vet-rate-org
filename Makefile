# Vet-Rate.org — one-command developer ergonomics.
# `make help` lists targets; everything else delegates to npm scripts.

.PHONY: help install dev test test-coverage lint format build preflight \
        preflight-fast preflight-extras check-markdown check-knip check-licenses \
        e2e clean audit sbom legal-ingest

help:
	@echo "vet-rate-org-official — make targets"
	@echo ""
	@echo "  install         npm ci (clean install)"
	@echo "  dev             vite dev server"
	@echo "  test            vitest run"
	@echo "  test-coverage   vitest run --coverage"
	@echo "  lint            eslint src"
	@echo "  format          prettier --write src"
	@echo "  build           production build"
	@echo "  e2e             playwright test"
	@echo "  preflight       full preflight (fix + prep + validate + ship)"
	@echo "  preflight-fast  skip e2e + build + version bump"
	@echo "  preflight-extras markdownlint + knip + license-checker (npx, no devDeps)"
	@echo "  check-markdown  markdownlint over all *.md (via npx)"
	@echo "  check-knip      dead-code + unused-deps scan (via npx)"
	@echo "  check-licenses  prod-dep license summary (via npx)"
	@echo "  audit           npm audit --omit=dev --audit-level=high"
	@echo "  sbom            generate CycloneDX SBOM → sbom.cdx.json"
	@echo "  legal-ingest    run-all.mjs over the legal-index pipeline"
	@echo "  clean           remove dist + coverage + playwright reports"

install:
	npm ci

dev:
	npm run dev

test:
	npm test

test-coverage:
	npm run test:coverage

lint:
	npm run lint

format:
	npm run format

build:
	npm run build

e2e:
	npx playwright test

preflight:
	npm run preflight

preflight-fast:
	npm run preflight:fast

preflight-extras:
	npm run preflight:extras

check-markdown:
	npm run check:markdown

check-knip:
	npm run check:knip

check-licenses:
	npm run check:licenses

audit:
	npm audit --omit=dev --audit-level=high

sbom:
	npm sbom --sbom-format=cyclonedx --omit=dev > sbom.cdx.json
	@echo "→ sbom.cdx.json"

legal-ingest:
	node scripts/legal-ingestion/run-all.mjs

clean:
	rm -rf dist coverage playwright-report .nyc_output
