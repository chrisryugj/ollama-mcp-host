# ollama-mcp-host

**English** | [한국어](README.ko.md)

> Run **multiple MCP servers at once** with a **local Ollama model** (gemma or any tool-capable model).
> No cloud, no API keys for the LLM — everything runs **on your own machine or inside your private network**. Perfect for **air-gapped / on-premise** environments.

[![npm](https://img.shields.io/npm/v/ollama-mcp-host)](https://www.npmjs.com/package/ollama-mcp-host)
[![license](https://img.shields.io/npm/l/ollama-mcp-host)](./LICENSE)

## What is this? (1-minute explanation)

A local AI model (like Google's `gemma`) is smart, but on its own it can't look things up or touch your files. To make it useful, you hand it **tools** — and the open standard for AI tools is **MCP (Model Context Protocol)**.

The problem: **Ollama and MCP servers don't speak the same language.** Ollama doesn't know how to call an MCP tool, and MCP servers don't know how to talk to Ollama. You need something in the middle.

**`ollama-mcp-host` is that translator.** Register one or more MCP servers, and a single Ollama model will automatically pick the right tool, call it, and answer based on the real result.

```
 You: "Which agency oversees the Road Traffic Act?"
        │
        ▼
 [Ollama model] ──"use the law search tool"──▶ [ollama-mcp-host] ──▶ [an MCP server] ──▶ data source
        ▲                                            │
        └──────────"it's the Police Agency!"──────────┘
        │
        ▼
 Answer: "The Road Traffic Act is overseen by the Korean National Police Agency…"
```

The examples in this README use two real Korean public-sector MCP servers, but **any stdio MCP server works** — register your own and the same flow applies:

- 🔍 **[korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp)** — Korean statute & case-law search
- 📄 **[kordoc](https://github.com/chrisryugj/kordoc)** — Korean office documents (HWP/HWPX/PDF parse, fill, generate)

### Why you might want this

- **Privacy / air-gapped** — inference stays 100% local; nothing leaves your network.
- **One model, many tools** — a single chat session can search the law *and* generate a document.
- **Tiny footprint** — exactly **one** runtime dependency (`@modelcontextprotocol/sdk`). Ollama is reached via Node's built-in `fetch`.
- **CLI + library** — use the interactive terminal chat, or `import { McpHost }` into your own code.

---

## ⚠️ The #1 gotcha with gemma — turn off "thinking"

Models like gemma3 / gemma4 have a *thinking* mode. When it's on, the model often **reasons internally and then forgets to actually emit the tool call** — leaving `tool_calls` empty. This is the most common reason people say "I registered the tools but it never calls them."

**This host handles it for you** — it always sends `"think": false` to Ollama's `/api/chat`, so tool calls fire reliably. If you ever call Ollama directly, set `think: false` yourself.

---

## Requirements

| Need | Purpose | Set up in |
|------|---------|-----------|
| **Node.js 20+** | Runs this host and the MCP servers | Step 1 |
| **Ollama + a tool-capable model** | The actual AI | Step 2 |
| **One or more MCP servers** | The tools you give the model | Step 3 |

> 💡 **Air-gapped / no internet?** Read [Running inside an offline network](#-running-inside-an-offline-network) first to mirror everything in, then come back to these steps.

---

## Quick start

### Step 1. Check Node.js

```bash
node --version          # need v20+; if missing, install the LTS from nodejs.org
```

### Step 2. Install Ollama and pull a model

[Ollama](https://ollama.com) runs AI models locally, for free.

```bash
ollama pull gemma4:e4b   # lightweight, tool-capable
ollama serve             # keep this running (default: http://localhost:11434)
ollama show gemma4:e4b   # ★ "Capabilities" MUST list `tools`, or tool calls won't work
```

> #### 💻 gemma4:e4b minimum specs
>
> These are for the PC that *actually runs the model* (with [Strategy A](#strategy-a--one-ollama-server-everyone-else-connects-remotely-recommended), only one server needs this).
>
> | | Minimum | Recommended | Notes |
> |---|---|---|---|
> | **Disk** | 12 GB | 20 GB | Model file is ~**9.6 GB** |
> | **RAM** | 8 GB | 16 GB | To hold the model in memory on CPU-only setups |
> | **GPU** | Not required | Apple Silicon unified memory, or 6 GB+ VRAM | Much faster with a GPU; works on CPU too (slower) |
>
> `e4b` activates only the parameters it needs, so **actual runtime footprint is ~3.3 GB** even though the file is 9.6 GB — RAM/VRAM pressure is lower than the disk size suggests.
> *(Measured: Apple M5 · 32 GB RAM · 3.3 GB on GPU · comfortable at 32K context.)*
>
> 💡 With **Strategy A**, only the server needs these specs. Client PCs just connect over the network, so any ordinary office machine that can run Node is enough.

### Step 3. Get your MCP servers (example: the two Korean tools)

```bash
# Law search
git clone https://github.com/chrisryugj/korean-law-mcp.git
cd korean-law-mcp && npm install && npm run build && pwd && cd ..
#   → builds korean-law-mcp/build/index.js  (note the full path)

# Documents
git clone https://github.com/chrisryugj/kordoc.git
cd kordoc && npm install && npm run build && pwd && cd ..
#   → builds kordoc/dist/mcp.js  (note the full path)
```

> 📌 A "full (absolute) path" starts from `/` (or `C:\` on Windows), e.g. `/Users/me/korean-law-mcp/build/index.js`. You'll paste these into the config next.

### Step 4. Install this host

```bash
npm install -g ollama-mcp-host
# or run without installing:  npx ollama-mcp-host --help
```

### Step 5. Write the config — `mcp.config.json`

Create `mcp.config.json` in your working folder:

```jsonc
{
  "model": "gemma4:e4b",
  "ollamaHost": "http://localhost:11434",
  "system": "You are an assistant for Korean law and official documents. When a relevant tool exists, always call it to fetch real data before answering. Never invent statute or case numbers.",
  "maxToolRounds": 8,
  "servers": [
    {
      "name": "law",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/korean-law-mcp/build/index.js"],
      "env": { "LAW_OC": "${LAW_OC}" }     // ${ENV} is substituted at runtime
    },
    {
      "name": "kordoc",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/kordoc/dist/mcp.js"]   // kordoc needs no API key
    }
  ]
}
```

- The only things you must fill in are the two `args` paths from Step 3.
- `"${VAR}"` is replaced by the environment variable at runtime, so **you never hard-code secrets** in the file. A clean, comment-free version lives in [`mcp.config.example.json`](./mcp.config.example.json).
- `korean-law-mcp` needs a free API key (`LAW_OC`) from [open.law.go.kr](https://open.law.go.kr); `kordoc` needs none.

### Step 6. Run

```bash
LAW_OC=your-key ollama-mcp-host -c mcp.config.json
# Windows:  set LAW_OC=your-key   (then run the command)
```

You should see:
```
config: mcp.config.json · model: gemma4:e4b
connecting MCP servers...
connected: law, kordoc · 19 tools

Type a question. /tools to list tools · /exit to quit
>
```

### Step 7. Use it

```
> Which agency oversees the Road Traffic Act?
  ↳ [law] search_law({"query":"도로교통법"})       ← the model calls a tool
  ✓ search_law: 3 results …                        ← the tool returns real data
Answer: The Road Traffic Act is overseen by the Korean National Police Agency …

> Generate a report HWPX with this content. Save to /Users/me/result.hwpx
  ↳ [kordoc] generate_document({...})
  ✓ generate_document: HWPX created …
Answer: The report was created at /Users/me/result.hwpx.
```

In-chat commands: `/tools` (list available tools), `/exit` (quit).

---

## 🏢 Running inside an offline network

Air-gapped networks usually block all of these, so `ollama pull`, `npm install`, and `git clone` simply won't work:

| Blocked site | What it normally provides |
|------|------|
| `ollama.com` | Ollama itself + AI models |
| `nodejs.org` | the Node.js engine |
| `github.com` | source code |
| `registry.npmjs.org` | npm packages |

The plan is always: **download where there *is* internet → carry it into the network → serve it from one place inside**. Mix the two strategies below.

### Strategy A — one Ollama server, everyone else connects remotely (recommended)

Model files are several GB, so installing them on every PC is wasteful. Put Ollama + the model on **one capable machine**, and have everyone else connect to it over the LAN. This host supports it via the `ollamaHost` setting.

**On the server (the machine with the model)** — make Ollama listen on all interfaces:

- **Linux (systemd):** add to the `[Service]` section of `/etc/systemd/system/ollama.service`, then `sudo systemctl daemon-reload && sudo systemctl restart ollama`
  ```ini
  Environment="OLLAMA_HOST=0.0.0.0:11434"
  ```
- **Windows:** add a system env var `OLLAMA_HOST = 0.0.0.0:11434`, then sign out/in.
- **macOS:** `launchctl setenv OLLAMA_HOST "0.0.0.0:11434"`, then restart Ollama.

Then **allow inbound port `11434`** in the firewall. Ollama has **no built-in authentication**, so expose it only on the trusted LAN — never to the public internet. For stronger isolation use an SSH tunnel or a private VPN.

**On every other PC (clients)** — no model needed, just point `ollamaHost` at the server:
```jsonc
{
  "model": "gemma4:e4b",
  "ollamaHost": "http://192.168.0.10:11434",   // ← the server's IP
  ...
}
```
Verify connectivity from a client:
```bash
curl http://192.168.0.10:11434/api/tags        # a JSON model list means you're connected
```

### Strategy B — mirror each piece in and serve it locally

| Item | Get it (online) | Serve it (offline) |
|------|------|------|
| **Node.js** | installer or tarball from [nodejs.org](https://nodejs.org) | host on a file server / share; tarball just needs unzip + PATH |
| **Ollama** | installer from [ollama.com/download](https://ollama.com/download) | distribute via share |
| **AI model** | `ollama pull gemma4:e4b`, then copy `~/.ollama/models` | see *moving models* below |
| **Source code** | `git clone` or GitHub "Download ZIP" | mirror to an internal Git (GitLab/Gitea), or ZIP to a share |
| **npm packages** | `npm pack`, or run an internal registry | see *moving npm packages* below |

**Moving models** — models are just files:
```bash
# online machine
ollama pull gemma4:e4b
tar -czf gemma4-e4b.tar.gz -C ~/.ollama models

# offline machine (or your Strategy-A server)
tar -xzf gemma4-e4b.tar.gz -C ~/.ollama
ollama list                                     # gemma4:e4b should appear
```
- To share one model dir across machines over NFS/SMB, run with `OLLAMA_MODELS=/shared/path/models ollama serve`.
- ⚠️ A partially-copied model fails silently or returns gibberish — **verify SHA-256 checksums** after transfer.

**Moving npm packages** — pick one:
- *Simple (tgz):* `npm pack ollama-mcp-host` produces a `.tgz`; offline, `npm install -g ./ollama-mcp-host-0.1.0.tgz`. For the MCP servers, copy the folders with `node_modules` already installed.
- *Proper (internal mirror):* stand up [Verdaccio](https://verdaccio.org) at the network edge, then `npm config set registry http://your-mirror` and `npm install` as usual.

> In short: keep the heavy **model on one server (Strategy A)** and distribute the lightweight **host + tools to each PC (Strategy B)**.

### ★ Most common offline failure: the firewall

`korean-law-mcp` reaches out to the National Law Information Center (`law.go.kr`) to fetch real statutes. If your network blocks that outbound connection, you'll see:

> "the tool *is* called (↳ shows up) but no law content comes back"

Ask your network admin to **allow outbound to `law.go.kr`** (or route it through an internal proxy). `kordoc` makes no external calls — it only reads local files — so it's unaffected.

> 💡 One runtime is enough — this host and both MCP servers all run on Node, so there's no Python or extra runtime to ship. This host's only third-party dependency is `@modelcontextprotocol/sdk`, keeping the transfer tiny.

---

## 🩺 Troubleshooting

| Symptom | Likely cause | Fix |
|------|------|------|
| Model answers in words but never calls a tool | thinking mode, or model lacks tool support | This host disables thinking automatically. Still failing? Check `ollama show <model>` for `tools` |
| `Ollama connection failed` | Ollama isn't running | start `ollama serve` (or check `ollamaHost`) |
| `MCP server '...' failed to connect` | wrong path, or server not built | verify the `args` path and that you ran `npm run build` |
| Tool runs but returns an error (`✗`) | missing/typo'd key, or firewall | check `LAW_OC`; on an offline net, check `law.go.kr` access |

---

## 🧑‍💻 Use as a library

```ts
import { McpHost, loadConfig } from "ollama-mcp-host";

const host = new McpHost(loadConfig("mcp.config.json"));
await host.connect();

const messages = [{ role: "user", content: "Show me Article 15 of the Personal Information Protection Act" }];
const updated = await host.chat(messages, {
  onToolCall: (i) => console.log(`tool call: ${i.server}.${i.tool}`),
});
console.log(updated.at(-1)?.content);

await host.close();
```

Build from source:
```bash
git clone https://github.com/chrisryugj/ollama-mcp-host.git
cd ollama-mcp-host && npm install && npm run build && npm test
```

### CLI options
| Option | Description |
|------|------|
| `-c, --config <path>` | config file (default `mcp.config.json`) |
| `-m, --model <tag>` | override the model for this run |
| `--once "<question>"` | answer a single question and exit (for scripts) |
| `-h, --help` | help |

### Config notes
- `"${VAR}"` is substituted from the environment at runtime — keep secrets out of the file.
- If two servers expose a tool with the same name, they're auto-namespaced as `server__tool`.
- For an npm-installed MCP server you can use `"command": "npx", "args": ["-y", "korean-law-mcp"]` (prefer absolute paths when offline).

---

## Verified on

`gemma4:e4b` (Ollama 0.30) + `korean-law-mcp` 4.4.2 + `kordoc` 3.5.1, Node 26 / macOS — both servers running together, with real tool calls (law search and HWPX generation) confirmed end-to-end.

## License

MIT
