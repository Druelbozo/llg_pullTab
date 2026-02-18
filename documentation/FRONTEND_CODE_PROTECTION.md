# Front-End Code Protection & Build System

This document describes the build system, deployment workflow, and how we protect the front-end source code for the Pull-Tabs game.

---

## Table of Contents

1. [Overview](#overview)
2. [The Problem: Exposed Source Code](#the-problem-exposed-source-code)
3. [What Is Vite?](#what-is-vite)
4. [How We Protect Front-End Code](#how-we-protect-front-end-code)
5. [Changes Made](#changes-made)
6. [How Deployment Works](#how-deployment-works)
7. [Build Output Structure](#build-output-structure)
8. [Usage Guide](#usage-guide)
9. [Development vs Production](#development-vs-production)
10. [Security Expectations](#security-expectations)

---

## Overview

The Pull-Tabs game uses a **production build pipeline** that bundles and minifies the front-end JavaScript before deployment. Instead of deploying raw source files, we deploy a single bundled file that is harder to read and reverse-engineer.

**Key components:**
- **Vite** – Build tool that bundles JavaScript and CSS
- **Production deploy** – Builds first, then syncs the `dist/` folder to S3

---

## The Problem: Exposed Source Code

When deploying raw source files to a web server, anyone can open the browser's Developer Tools (F12) → Sources tab and see:

- The full folder structure (`src/scenes/`, `src/prefabs/`, `src/utils/`, etc.)
- Individual `.js` files with readable code, comments, and variable names
- Theme systems, game config, and other implementation details

This makes it easy for others to copy or reuse the code. While front-end code can never be fully hidden, we can make it harder to read and understand.

---

## What Is Vite?

**Vite** is a modern front-end build tool created by Evan You (creator of Vue.js). It is used by many JavaScript frameworks and plain JS projects.

### Why Vite?

| Feature | Benefit |
|---------|---------|
| **Fast builds** | Uses esbuild (written in Go) for very fast bundling |
| **Native ES modules** | Works well with `import`/`export` without extra config |
| **HTML as entry** | Uses `index.html` as the entry point, which fits our setup |
| **Built-in CSS bundling** | Combines and minifies CSS automatically |
| **Plugin ecosystem** | Easy to add obfuscation and other build steps |

### How Vite Works

1. **Development:** Vite serves files with native ES modules and on-demand transpilation.
2. **Production:** Vite uses Rollup to bundle everything into optimized output files.

For our project, we use Vite for both development (`vite dev` / `start-servers.js`) and production build.

---

## How We Protect Front-End Code

We use several layers of protection:

### 1. Bundling

- **Before:** Multiple separate `.js` files (scenes, prefabs, utils, etc.)
- **After:** One main `game-[hash].js` file

**Effect:** The original file structure and module boundaries are hidden. There is no visible `src/scenes/Level.js` or `src/prefabs/game/ThemeManager.js`. Game config is bundled into the JS.

### 2. Minification

- Removes comments and unnecessary whitespace
- Shortens variable and function names where possible
- Shrinks file size and makes code harder to read

### 3. No Source Maps in Production

- Source maps (`.map` files) would map bundled code back to original source
- We disable them in production so the original structure and names stay hidden

### What Stays Unprotected

- **Assets** (images, fonts, audio) – Must be served as files for Phaser to load
- **Theme JSON** (`src/config/themes/*.json`) – Loaded at runtime for themes
- **Game config** (`src/config/game/*.js`) – Copied to dist for runtime use

---

## Changes Made

### New Files

| File | Purpose |
|------|---------|
| `vite.config.js` | Vite configuration: entry, output, static copy |
| `package.json` | Root deps + dev/build/deploy scripts |
| `scripts/local-testing/ports.config.js` | Port allocation (CORS 8083, Vite 5502) |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Script path for Vite; CSS moved to import in main.js |
| `src/main.js` | Added CSS import for styles |
| `scripts/deploy/deploy.js` | Added `--production` and `--no-build`; runs build before sync when `--production` is used |
| `scripts/aws/s3/sync_to_s3.py` | Added `--from-dir` and `--production` for syncing from `dist/` |
| `scripts/aws/aws_config.py` | Added `DEFAULT_PATHS`, `PRODUCTION_PATHS`, `SKIP_EXTENSIONS` |
| `scripts/local-testing/start-servers.js` | Python HTTP server replaced with Vite dev server |

### Configuration Details

**vite.config.js:**
- Entry: `index.html`
- Output: `dist/` with hashed filenames for cache busting
- Static copy: `assets/`, `src/config/themes/`, `src/config/game/`
- Source maps: disabled

---

## How Deployment Works

### Two Deployment Modes

#### 1. Production Deploy (Recommended for Public Game)

```
npm run build  →  dist/  →  S3 sync (dist contents)  →  CloudFront invalidation
```

- Runs `vite build` to create `dist/`
- Syncs `dist/` contents to S3 (no raw `src/` folder)
- Invalidates CloudFront cache

**Command:** `node scripts/deploy/deploy.js --production --yes`

#### 2. Standard Deploy (For Editor / Raw Source)

- Syncs raw source files (`src/`, `assets/`, etc.) to S3
- Used when you need the full source structure

**Command:** `node scripts/deploy/deploy.js --yes`

### Deploy Script Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  node scripts/deploy/deploy.js --production --yes                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 0: npm run build (unless --no-build)                       │
│  • Vite bundles JS + CSS                                          │
│  • Static files copied to dist/                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: python scripts/aws/s3/sync_to_s3.py --production        │
│  • Uses dist/ as root                                             │
│  • Syncs: index.html, assets, js, src/config/themes, src/config/game │
│  • Uploads to S3, deletes orphaned files                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: python scripts/aws/cloudfront/invalidate_cloudfront.py   │
│  • Invalidates CloudFront cache for updated paths                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flags

| Flag | Description |
|------|-------------|
| `--production` | Build and deploy production bundle from `dist/` |
| `--no-build` | Skip build; sync existing `dist/` (use with `--production`) |
| `--yes` | Skip confirmation prompts |
| `--dry-run` | Preview changes without uploading |

---

## Build Output Structure

After `npm run build`, the `dist/` folder contains:

```
dist/
├── index.html              # Entry point with bundled script/CSS refs
├── js/
│   └── game-[hash].js      # Bundled, minified game
├── assets/
│   ├── images/             # Game images
│   ├── preload-asset-pack.json
│   └── ...
└── src/
    └── config/
        ├── themes/         # Theme JSON files (runtime-loaded)
        │   ├── yummy.json
        │   ├── lumberjack.json
        │   └── ...
        └── game/           # Game config (runtime-loaded)
            ├── game-config.js
            └── ...
```

The `[hash]` in filenames enables cache busting: when the bundle changes, the hash changes and browsers load the new file.

---

## Usage Guide

### Build Only

```bash
npm run build
```

Creates `dist/` with the production bundle. Use this to test the build locally (e.g. with `npx serve dist`).

### Production Deploy (Build + Sync)

```bash
node scripts/deploy/deploy.js --production --yes
```

Builds and deploys. Use for normal production updates.

### Production Deploy Without Rebuilding

```bash
node scripts/deploy/deploy.js --production --no-build --yes
```

Use when only assets or config changed and the JS bundle is unchanged.

### Standard Deploy (Raw Source)

```bash
node scripts/deploy/deploy.js --yes
```

Syncs raw source. Use when deploying the full source tree.

### Dry Run (Preview)

```bash
node scripts/deploy/deploy.js --production --dry-run
```

Shows what would be uploaded without making changes.

---

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Source** | Raw `src/` files | Bundled `dist/js/game-[hash].js` |
| **CSS** | Separate `.css` files or Vite dev | Single bundled CSS |
| **Structure** | Full folder tree visible | Single main JS file |
| **Deploy** | `deploy.js` (no `--production`) | `deploy.js --production` |

For local development, use:
- `npm run local-test` (Vite dev server on port 5502, CORS proxy on 8083)
- `npm run dev` or `npx vite` (Vite dev server on port 5502)

---

## Security Expectations

**What this achieves:**
- Hides file structure and module boundaries
- Makes code harder to read and copy
- Raises the effort needed to reverse-engineer

**What it does not achieve:**
- Complete protection – determined users can still inspect and modify the bundle
- Protection of secrets – never put API keys or secrets in front-end code
- Server-side security – sensitive logic must stay on the server (as with your game logic)

**Best practice:** Treat front-end protection as a deterrent, not a guarantee. Keep sensitive logic and data on the server.
