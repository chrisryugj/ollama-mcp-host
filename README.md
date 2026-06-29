# ollama-mcp-host

로컬 [Ollama](https://ollama.com) 모델(gemma 등 tool-capable 모델)로 **여러 MCP 서버를 한꺼번에** 돌리는 호스트. `korean-law-mcp`(법령 검색)와 `kordoc`(공문서/서식)을 설정에 등록해 두면, 하나의 모델이 두 서버의 도구를 알아서 골라 호출한다.

- **클라우드 API 불필요** — 추론은 전부 로컬 Ollama. 인터넷이 막힌 **내부망/오프라인**에서 동작.
- **런타임 의존성 1개** — `@modelcontextprotocol/sdk` 뿐. Ollama 호출은 Node 내장 `fetch`.
- **CLI + 라이브러리** — 터미널 대화용 CLI와, 다른 코드에서 `import` 하는 `McpHost` API 둘 다 제공.

```
[Ollama 모델] ──tool_call──▶ [ollama-mcp-host] ──stdio──▶ [korean-law-mcp] ─▶ 법제처 API
  (gemma4:e4b)                     │      └────────stdio──▶ [kordoc] ─▶ HWPX 파싱/생성
       ▲                          │
       └────────tool 결과 주입──────┘   (도구 호출이 멈출 때까지 반복)
```

## ⚠️ gemma 사용 시 핵심 주의 — thinking 끄기

gemma3 / gemma4 같은 **thinking 지원 모델은 thinking 을 켜두면 추론만 길게 하고 `tool_calls` 를 비워서** 내보내는 경우가 있다. 즉 "도구가 호출이 안 된다"고 헤매게 된다.

→ 이 호스트는 Ollama `/api/chat` 에 항상 **`think: false`** 를 보내 이 문제를 회피한다. 직접 클라이언트를 짤 때도 동일하게 처리해야 한다.

## 설치

### npm (인터넷 가능 환경)

```bash
npm install -g ollama-mcp-host
# 또는 설치 없이
npx ollama-mcp-host --help
```

### 소스에서

```bash
git clone https://github.com/chrisryugj/ollama-mcp-host.git
cd ollama-mcp-host
npm install && npm run build
```

## 사전 준비

1. **Ollama 실행 + tool-capable 모델**
   ```bash
   ollama pull gemma4:e4b
   ollama serve                 # 기본 http://localhost:11434
   ollama show gemma4:e4b       # Capabilities 에 'tools' 가 있어야 함
   ```
2. **돌릴 MCP 서버 빌드** (예시)
   ```bash
   # 법령
   git clone https://github.com/chrisryugj/korean-law-mcp && cd korean-law-mcp && npm i && npm run build
   # 공문서
   git clone https://github.com/chrisryugj/kordoc && cd kordoc && npm i && npm run build
   ```

## 설정 — `mcp.config.json`

`mcp.config.example.json` 을 복사해 경로/키를 채운다.

```jsonc
{
  "model": "gemma4:e4b",
  "ollamaHost": "http://localhost:11434",
  "system": "당신은 한국 법령 검색과 공문서 작성을 돕는 비서입니다. ...",
  "maxToolRounds": 8,
  "servers": [
    {
      "name": "law",
      "command": "node",
      "args": ["/절대경로/korean-law-mcp/build/index.js"],
      "env": { "LAW_OC": "${LAW_OC}" }     // ${ENV} 는 실행 시 환경변수로 치환
    },
    {
      "name": "kordoc",
      "command": "node",
      "args": ["/절대경로/kordoc/dist/mcp.js"]   // kordoc 은 API 키 불필요
    }
  ]
}
```

- `${VAR}` 문자열은 실행 시 `process.env.VAR` 로 치환된다 → **API 키를 설정파일에 하드코딩하지 않는다.**
- `name` 은 라우팅·표시용 식별자. 두 서버에 같은 이름의 도구가 있으면 자동으로 `서버명__도구명` 으로 구분된다.
- npm 으로 설치한 MCP 서버라면 `command`/`args` 를 `"npx"`, `["-y", "korean-law-mcp"]` 식으로 써도 된다(오프라인이면 글로벌 설치 후 절대경로 권장).

## 사용

### 대화형 CLI

```bash
LAW_OC=발급받은키 ollama-mcp-host -c mcp.config.json
```
```
> 도로교통법 소관 부처가 어디야?
  ↳ [law] search_law({"query":"도로교통법"})
  ✓ search_law: 검색 결과 (총 3건) …
답변: 도로교통법의 핵심 소관은 경찰청입니다 …

> 위 내용으로 보고서 HWPX 만들어줘. 경로는 /tmp/report.hwpx
  ↳ [kordoc] generate_document({...})
  ✓ generate_document: ✓ HWPX 생성 …
```

대화 중 명령: `/tools` (도구 목록), `/exit` (종료).

옵션:
| 옵션 | 설명 |
|------|------|
| `-c, --config <path>` | 설정 파일 (기본 `mcp.config.json`) |
| `-m, --model <tag>` | 설정의 model 덮어쓰기 |
| `--once "<질문>"` | 질문 하나만 처리하고 종료 (스크립트용) |

### 라이브러리

```ts
import { McpHost, loadConfig } from "ollama-mcp-host";

const host = new McpHost(loadConfig("mcp.config.json"));
await host.connect();

const messages = [{ role: "user", content: "개인정보보호법 제15조 알려줘" }];
const updated = await host.chat(messages, {
  onToolCall: (i) => console.log(`호출: ${i.server}.${i.tool}`),
});
console.log(updated.at(-1)?.content);

await host.close();
```

## 🏢 내부망 / 오프라인 반입 가이드

인터넷이 차단된 망에 옮길 때 체크리스트.

1. **Ollama 모델** — 인터넷 되는 PC에서 `ollama pull gemma4:e4b` 후 `~/.ollama/models` 를 통째로 반입하거나 사내 레지스트리 사용. 반입 후 `ollama show gemma4:e4b` 로 `tools` capability 확인.
2. **Node 런타임** — Node 20+ 설치본 반입 (이 호스트와 두 MCP 모두 Node라 런타임은 하나면 충분).
3. **패키지** — 세 레포(`ollama-mcp-host`, `korean-law-mcp`, `kordoc`) 각각 `npm install` 까지 끝낸 폴더(`node_modules` 포함)를 통째로 반입하거나, 사내 npm 미러(verdaccio 등) 사용. 이 호스트는 런타임 의존성이 `@modelcontextprotocol/sdk` 하나뿐이라 반입이 가볍다.
4. **법제처 API 키(`LAW_OC`)** — [법제처 오픈API](https://open.law.go.kr) 에서 발급받아 환경변수로 주입.
5. **★ 방화벽** — `korean-law-mcp` 는 내부망에서 **`law.go.kr` (법제처 OpenAPI) 로 아웃바운드**가 열려 있어야 실제 법령을 가져온다. 여기가 막히면 "도구 호출은 되는데 법령이 안 옴". 가장 흔한 실패 지점이니 먼저 확인할 것. (`kordoc` 은 외부 통신 없이 로컬 파일만 다루므로 방화벽 무관.)

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------|
| 모델이 도구를 안 부르고 말로만 답함 | thinking 모델 → 이 호스트는 `think:false` 로 처리. 그래도 안 되면 `ollama show <model>` 에서 `tools` capability 확인 |
| `Ollama 연결 실패` | `ollama serve` 미실행 또는 `ollamaHost` 주소 오류 |
| `MCP 서버 '...' 연결 실패` | `command`/`args` 경로 확인, 해당 MCP 가 빌드됐는지(`build/`·`dist/`) 확인 |
| 법령 검색 결과가 비거나 오류 | `LAW_OC` 키 누락/오타, 또는 `law.go.kr` 아웃바운드 차단 |

## 검증 환경

`gemma4:e4b` (Ollama 0.30) + `korean-law-mcp` 4.4.2 + `kordoc` 3.5.1, Node 26 / macOS 에서 두 MCP 동시 구동·실제 도구 호출 확인.

## 라이선스

MIT
