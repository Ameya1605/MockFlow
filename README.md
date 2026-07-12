# MockFlow AI

Zero-code, stateful, AI-generated API mocking for local frontend development — as a VS Code extension.

MockFlow AI runs a local proxy that intercepts requests to your unbuilt/unavailable backend, scans your TypeScript codebase for the relevant `interface`, and asks an LLM to generate realistic mock data matching that shape. Unlike static JSON mocks, state persists in memory — a `POST` actually shows up in the next `GET`, a `DELETE` actually removes it.

## How it works

```
Frontend fetch() → Express proxy (localhost:3939)
                        ↓
              parse route → guess interface name (e.g. /api/users → User)
                        ↓
              ts-morph scans workspace → finds exported `interface User { ... }`
                        ↓
              schema + route + method → prompt → Gemini API
                        ↓
              AI-generated JSON ← cached in in-memory store
                        ↓
              subsequent GET/POST/PUT/DELETE read/mutate the same store
```

## Prerequisites

- Node.js 18+
- VS Code 1.85+
- A free [Google AI Studio](https://aistudio.google.com/apikey) API key (Gemini)

## Install (from a packaged release)

If you just want to use the extension without building it yourself:

```bash
code --install-extension mockflow-ai-0.0.1.vsix
```

Then skip to [Configure your API key](#configure-your-api-key) below.

## Build from source

```bash
git clone https://github.com/Ameya1605/MockFlow.git
cd MockFlow
npm install
npm run compile
```

`npm run compile` bundles the extension with esbuild into a single `out/extension.js`, inlining all runtime dependencies (`express`, `ts-morph`, `pluralize`, `dotenv`) so the extension doesn't need a shipped `node_modules` folder.

### Package it yourself

```bash
npm install -g @vscode/vsce
vsce package
```

Produces `mockflow-ai-0.0.1.vsix` in the project root — a real, installable extension file. `.vscodeignore` keeps the package small and, critically, keeps `.env` out of it — **never remove `.env` from `.vscodeignore` or `.gitignore`**, or your API key will ship inside the package.

## Configure your API key

MockFlow AI loads your Gemini API key from a `.env` file in the extension's own installation directory, via `dotenv`. It falls back to a real OS environment variable if no `.env` file is found.

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your key:
   ```
   GEMINI_API_KEY=your-actual-key-here
   ```

`.env` is gitignored and excluded from the packaged `.vsix` on purpose — never commit it or share it.

If you'd rather not use a `.env` file, you can set a real environment variable instead:

**Windows (PowerShell):**
```powershell
setx GEMINI_API_KEY "your-actual-key-here"
```
Fully close and reopen VS Code afterward so the new process inherits the updated environment.

**macOS/Linux:** add `export GEMINI_API_KEY="your-actual-key-here"` to your `~/.zshrc` / `~/.bashrc`, then restart your terminal and VS Code.

If the key is missing entirely, clicking **Start Server** will show a clear VS Code error message rather than silently starting a broken server.

## Running the extension (development)

1. Open this project folder in VS Code.
2. Press **F5** (or Run → Start Debugging). This launches a second `[Extension Development Host]` window with the extension loaded.
3. In that new window, open **a separate folder** containing the TypeScript interfaces you want mocked (see "Test workspace convention" below) — the extension scans whichever folder is open in the Dev Host, not its own source.
4. Click the MockFlow AI icon in the Activity Bar (radio-tower icon) to open the sidebar.
5. Click **Start Server**. The status text should update to `Running on port 3939`.
6. Point your frontend app's `fetch()` calls (or your `.env`'s `API_BASE_URL`) at `http://localhost:3939`.

## Test workspace convention

MockFlow AI resolves `GET /api/users` → looks for an **exported** interface named `User` (singular, capitalized) anywhere in the open workspace. Example:

```typescript
// src/types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  isActive: boolean;
}
```

A `tsconfig.json` must exist at the workspace root for `ts-morph` to resolve the project correctly; if none is found, it falls back to scanning all `**/*.ts` files (excluding `node_modules` and `.d.ts` files).

Route → interface name resolution uses the [`pluralize`](https://www.npmjs.com/package/pluralize) package, so irregular plurals resolve correctly (`/api/categories` → `Category`, not `Categorie`).

## Chaos engineering

The sidebar includes two controls to simulate real-world network conditions:

- **Latency (ms):** delays every response by the given amount.
- **Error rate (%):** the percentage of requests that receive a `500 Simulated chaos failure` instead of the real mock response.

Click **Apply Chaos Settings** after changing either value — it takes effect immediately on the next request, no restart needed. Remember to reset both to `0` when you're done testing failure states, or every request will keep failing/lagging.

## API reference (per-resource)

For any exported interface `Foo`, once at least one interface exists in the workspace:

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/foos` | Returns cached array if it exists; otherwise generates 3–5 AI records, caches, and returns them. |
| `POST` | `/api/foos` | AI-backfills any fields missing from the request body, merges (body wins), creates a record, returns `201`. |
| `PUT` | `/api/foos/:id` | Merges the request body into the existing record. `404` if the id doesn't exist. |
| `DELETE` | `/api/foos/:id` | Removes the record. `204` on success, `404` if the id doesn't exist. |

State is **in-memory only** — restarting the server via Stop/Start clears all generated and mutated data back to nothing.

## Manual test script

`test-integration.js` in the project root is a zero-dependency Node script that exercises the full stateful lifecycle (GET → cache check → POST → GET → PUT → DELETE → DELETE again) against a running server:

```bash
node test-integration.js
```

Requires the extension's server to already be running (`localhost:3939`) and at least a `User` interface present in the open test workspace.

## Known limitations

- **No pre-flight validation of key format** — an invalid (but present) key still fails on the first request rather than at startup.
- **State does not persist across server restarts** — by design, for now. A future version could optionally persist the store to a local JSON file.
- **No support for nested/related resource routes** (e.g. `/api/users/:id/orders`) — route parsing currently assumes a flat `/api/resource` or `/api/resource/:id` shape.
- **Single hardcoded port (3939)** — not currently configurable from the sidebar UI.
- **Large bundle size (~13MB uncompressed, ~2.2MB packaged)** — this comes from `ts-morph` bundling the full TypeScript compiler for AST parsing; this is expected, not a bug, and comparable to other extensions doing similar AST work.

## Project structure

```
src/
├── extension.ts              # Activation, .env loading, server lifecycle, wiring
├── panels/
│   └── SidebarProvider.ts    # Webview UI (Start/Stop, chaos controls)
├── server/
│   ├── index.ts              # Express app, route handling, request lifecycle
│   ├── store.ts              # In-memory stateful data store
│   └── chaosMiddleware.ts    # Latency/error injection middleware
├── ast/
│   └── parser.ts             # ts-morph interface discovery & schema extraction
└── ai/
    ├── promptBuilder.ts      # Builds LLM prompts from route + schema + method
    └── orchestrator.ts       # Calls the Gemini API, parses the response
esbuild.js                    # Bundles src/extension.ts into out/extension.js
```

## License

MIT — see [LICENSE](./LICENSE).
