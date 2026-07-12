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

## Setup

```bash
git clone <this-repo>
cd mockflow-ai
npm install
```

### Configure your API key

Create a `.env` file in the project root (do **not** commit this):

```
GEMINI_API_KEY=your-actual-key-here
```

> **Note:** the current build reads the key via `process.env.GEMINI_API_KEY`, which VS Code's extension host inherits from your OS environment — not automatically from a `.env` file yet. Until `dotenv` loading is added (see Known Limitations), set it as a permanent environment variable instead:
>
> **Windows (PowerShell):**
> ```powershell
> setx GEMINI_API_KEY "your-actual-key-here"
> ```
> Then fully close and reopen VS Code so the new process inherits the updated environment.
>
> **macOS/Linux:** add `export GEMINI_API_KEY="your-actual-key-here"` to your `~/.zshrc` / `~/.bashrc`, then restart your terminal and VS Code.

### Build

```bash
npm run compile
```

## Running the extension

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

- **No `.env` auto-loading yet** — API key must currently be set as a real OS environment variable (see Setup above), not read from a project-local `.env` file. Adding `dotenv` to `extension.ts` would close this gap.
- **No pre-flight API key validation** — if the key is missing or invalid, the failure only surfaces on the *first request*, as a raw JSON error from the Gemini API rather than a friendly VS Code notification.
- **State does not persist across server restarts** — by design, for now. A future version could optionally persist the store to a local JSON file.
- **No support for nested/related resource routes** (e.g. `/api/users/:id/orders`) — route parsing currently assumes a flat `/api/resource` or `/api/resource/:id` shape.
- **Single hardcoded port (3939)** — not currently configurable from the sidebar UI.

## Project structure

```
src/
├── extension.ts              # Activation, server lifecycle, wiring
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
```

## License
Under Development 
