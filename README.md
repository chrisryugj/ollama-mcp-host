# ollama-mcp-host

> 내 컴퓨터에 깔린 **무료 AI(Ollama)** 에게 **법령 검색**과 **공문서 작성** 능력을 붙여 주는 프로그램입니다.
> 인터넷에 있는 ChatGPT 같은 외부 AI를 안 써도 됩니다. **전부 내 컴퓨터(또는 내부망) 안에서** 돌아갑니다.

## 이게 뭔가요? (1분 설명)

AI 모델(예: 구글 `gemma`)은 똑똑하지만, 혼자서는 "오늘 법이 어떻게 바뀌었는지", "이 한글 문서 안에 뭐가 들었는지"를 모릅니다. 인터넷이나 파일을 직접 못 보거든요.

그래서 **"도구"** 를 손에 쥐여 줘야 합니다.

- 🔍 **korean-law-mcp** = AI가 쓸 수 있는 *법령 검색 도구*
- 📄 **kordoc** = AI가 쓸 수 있는 *한글(HWP/HWPX) 문서 도구*

문제는, AI(Ollama)와 이 도구들(MCP)은 **서로 말이 안 통합니다.** 중간에서 통역해 주는 누군가가 필요해요.

**이 프로그램(`ollama-mcp-host`)이 바로 그 통역사입니다.**

```
 당신: "도로교통법 소관 부처가 어디야?"
        │
        ▼
 [AI 모델 gemma] ──"법령 검색 도구 좀 써줘"──▶ [이 프로그램] ──▶ [korean-law-mcp] ──▶ 법제처
        ▲                                          │
        └──────────"경찰청이래!"──────────────────────┘
        │
        ▼
 답변: "도로교통법의 소관 부처는 경찰청입니다…"
```

질문 한 번에 AI가 알아서 *어떤 도구를 쓸지 고르고*, 도구를 *직접 실행해서* 결과를 가져온 다음, 그걸 바탕으로 답해 줍니다. 당신은 그냥 한국어로 물어보기만 하면 됩니다.

---

## 🧰 시작 전 준비물

따라 하기 전에 아래 4가지가 필요합니다. 하나씩 같이 준비할 거예요.

| 준비물 | 용도 | 확인/설치 단계 |
|--------|------|------|
| **Node.js 20 이상** | 이 프로그램과 도구들이 돌아가는 엔진 | Step 1 |
| **Ollama + AI 모델** | 실제로 생각하는 AI | Step 2 |
| **두 MCP 도구** (법령·문서) | AI에게 쥐여 줄 도구 | Step 3 |
| **법제처 API 키** (`LAW_OC`) | 법령 검색에만 필요 (문서 작성은 불필요) | Step 5 |

> 💡 **인터넷이 안 되는 내부망**에 설치하는 경우, 먼저 아래 [내부망/오프라인 설치](#-인터넷이-안-되는-내부망에-설치하기) 단락을 읽고 파일들을 미리 옮긴 뒤 이 단계를 따라오세요.

---

## 🚀 따라 하기 (단계별)

### Step 1. Node.js가 깔려 있는지 확인

터미널(명령 프롬프트)을 열고 입력하세요.

```bash
node --version
```

- `v20.x.x` 이상 숫자가 나오면 OK. 다음 단계로.
- `command not found` 또는 버전이 낮으면 → [nodejs.org](https://nodejs.org) 에서 LTS 버전을 설치하세요.

### Step 2. Ollama 설치하고 AI 모델 받기

**Ollama**는 내 컴퓨터에서 AI를 돌려 주는 무료 프로그램입니다.

1. [ollama.com](https://ollama.com) 에서 설치합니다.
2. AI 모델을 내려받습니다. (여기서는 가볍고 도구 사용이 되는 `gemma4:e4b` 사용)
   ```bash
   ollama pull gemma4:e4b
   ```
3. Ollama를 실행해 둡니다. (창을 닫지 말고 켜 두세요)
   ```bash
   ollama serve
   ```
4. **★중요★** 이 모델이 "도구를 쓸 수 있는" 모델인지 확인합니다.
   ```bash
   ollama show gemma4:e4b
   ```
   출력의 **Capabilities** 항목에 **`tools`** 라는 단어가 있어야 합니다. 없으면 도구 호출이 안 됩니다. (gemma4:e4b 는 있습니다.)

### Step 3. 도구 두 개(법령·문서) 준비하기

AI에게 쥐여 줄 도구를 컴퓨터에 받아 빌드합니다. 둘 다 한 번씩만 하면 됩니다.

**① 법령 검색 도구 (korean-law-mcp)**
```bash
git clone https://github.com/chrisryugj/korean-law-mcp.git
cd korean-law-mcp
npm install
npm run build
pwd     # ← 여기 나오는 경로를 메모해 두세요 (나중에 설정에 씀)
cd ..
```
빌드가 끝나면 `korean-law-mcp/build/index.js` 파일이 생깁니다. **이 파일의 전체 경로**가 나중에 필요합니다.

**② 문서 도구 (kordoc)**
```bash
git clone https://github.com/chrisryugj/kordoc.git
cd kordoc
npm install
npm run build
pwd     # ← 이 경로도 메모
cd ..
```
빌드가 끝나면 `kordoc/dist/mcp.js` 파일이 생깁니다.

> 📌 "전체 경로(절대경로)"란? 예를 들어 `/Users/hong/korean-law-mcp/build/index.js` 처럼 맨 앞 `/`(윈도우는 `C:\`)부터 시작하는 주소입니다. `pwd` 명령이 알려 주는 현재 폴더 주소에 파일 이름을 붙이면 됩니다.

### Step 4. 이 프로그램(ollama-mcp-host) 설치

```bash
npm install -g ollama-mcp-host
```
설치 없이 한 번만 써보려면 `npx ollama-mcp-host` 도 됩니다.

### Step 5. 설정 파일 만들기 — `mcp.config.json`

이제 "어떤 AI 모델로, 어떤 도구들을 쓸지" 적은 설정 파일을 하나 만듭니다. 작업할 폴더에 `mcp.config.json` 이라는 이름으로 아래 내용을 저장하세요.

```jsonc
{
  // 사용할 Ollama 모델 (Step 2에서 받은 것)
  "model": "gemma4:e4b",

  // Ollama 주소 (기본값 그대로 두면 됩니다)
  "ollamaHost": "http://localhost:11434",

  // AI에게 주는 기본 지침 (그대로 두거나 입맛대로 수정)
  "system": "당신은 한국 법령 검색과 공문서 작성을 돕는 비서입니다. 관련 도구가 있으면 반드시 도구를 호출해 실제 데이터를 가져온 뒤 한국어로 답하세요. 법조문이나 판례 번호를 추측으로 지어내지 마세요.",

  // 등록할 도구들
  "servers": [
    {
      "name": "law",
      "command": "node",
      "args": ["여기에-Step3에서-메모한-korean-law-mcp/build/index.js-전체경로"],
      "env": { "LAW_OC": "${LAW_OC}" }
    },
    {
      "name": "kordoc",
      "command": "node",
      "args": ["여기에-Step3에서-메모한-kordoc/dist/mcp.js-전체경로"]
    }
  ]
}
```

> ⚠️ 위 `// 주석`은 설명용입니다. 진짜 JSON 파일에는 주석을 빼고 저장하는 게 안전합니다. (복사해서 쓸 깔끔한 버전은 저장소의 [`mcp.config.example.json`](./mcp.config.example.json) 을 참고하세요.)

**채워 넣을 곳은 딱 두 군데, `args` 의 경로입니다.** 예를 들면:
```json
"args": ["/Users/hong/korean-law-mcp/build/index.js"]
```

**법제처 API 키 (`LAW_OC`)**: 법령 검색을 쓰려면 [open.law.go.kr](https://open.law.go.kr) 에서 무료로 키를 발급받으세요. 설정 파일의 `"${LAW_OC}"` 부분은 *건드리지 말고*, 실행할 때 키를 넣어 줍니다(다음 단계). 이렇게 하면 키가 파일에 그대로 적히지 않아 안전합니다.

> 💡 문서 도구(kordoc)만 쓸 거면 법제처 키 없이도 됩니다. 그땐 `law` 서버 블록을 통째로 지워도 돼요.

### Step 6. 실행하기

```bash
LAW_OC=발급받은키 ollama-mcp-host -c mcp.config.json
```
(윈도우 명령 프롬프트라면: `set LAW_OC=발급받은키` 를 먼저 실행한 뒤 `ollama-mcp-host -c mcp.config.json`)

이런 화면이 뜨면 성공입니다.
```
설정: mcp.config.json · 모델: gemma4:e4b
MCP 서버 연결 중...
연결됨: law, kordoc · 도구 19개

질문을 입력하세요. /tools 도구목록 · /exit 종료
>
```

### Step 7. 실제로 써보기

`>` 뒤에 한국어로 물어보세요.

**예시 1 — 법령 검색**
```
> 도로교통법 소관 부처가 어디야?
  ↳ [law] search_law({"query":"도로교통법"})        ← AI가 도구를 부르는 중
  ✓ search_law: 검색 결과 (총 3건) …               ← 도구가 결과를 가져옴
답변: 도로교통법의 핵심 소관 부처는 경찰청입니다 …
```

**예시 2 — 문서 만들기**
```
> 회의 결과를 보고서로 만들어줘. 내용은 "신규 시스템 도입 검토 완료". 경로는 /Users/hong/result.hwpx
  ↳ [kordoc] generate_document({...})
  ✓ generate_document: ✓ HWPX 생성 …
답변: 보고서가 /Users/hong/result.hwpx 에 생성되었습니다.
```

대화 중 쓸 수 있는 명령:
- `/tools` — AI가 쓸 수 있는 도구 전체 목록 보기
- `/exit` — 종료

축하합니다. 🎉 내 컴퓨터 안에서만 도는 AI 법령·문서 비서가 완성됐습니다.

---

## ⚠️ gemma를 쓸 때 꼭 알아야 할 함정

gemma3·gemma4 같은 모델은 "생각(thinking)" 기능이 있습니다. 그런데 **이 기능이 켜져 있으면, AI가 속으로 고민만 길게 하다가 정작 도구를 안 부르고 끝나는** 경우가 많습니다. → "분명 도구를 등록했는데 호출이 안 돼!" 하고 헤매게 되는 가장 흔한 원인입니다.

**이 프로그램은 그 문제를 자동으로 막아 줍니다** (내부적으로 thinking을 꺼서 도구를 확실히 부르게 합니다). 그래서 별도 설정 없이 잘 동작합니다. 혹시 직접 코드로 Ollama를 부를 일이 있다면, 요청에 `"think": false` 를 꼭 넣으세요.

---

## 🏢 인터넷이 안 되는 내부망에 설치하기

내부망에서는 보통 아래 사이트들이 **전부 막혀 있습니다.** 그래서 `ollama pull`, `npm install`, `git clone` 같은 명령이 그냥 안 됩니다.

| 막히는 사이트 | 원래 거기서 받는 것 |
|------|------|
| `ollama.com` | Ollama 본체 + AI 모델 |
| `nodejs.org` | Node.js 엔진 |
| `github.com` | 소스코드 (이 프로그램·두 도구) |
| `registry.npmjs.org` | npm 라이브러리 패키지 |
| `law.go.kr` | (실행 중) 실제 법령 데이터 |

해결의 큰 그림은 **"인터넷 되는 곳에서 받아 → 내부망 안의 한 지점에 갖다 놓고 → 내부망 PC들이 거기서 가져다 쓰게"** 하는 것입니다. 아래 두 전략을 상황에 맞게 섞어 쓰세요.

---

### 전략 A. 🌟 Ollama 서버 한 대만 두고, 나머지 PC는 원격 접속 (강력 추천)

AI 모델 파일은 수 GB라 PC마다 까는 게 부담입니다. **내부망에 성능 좋은 PC/서버 한 대**에만 Ollama와 모델을 설치하고, 나머지 PC들은 네트워크로 그 한 대에 접속해 쓰면 됩니다. (이 프로그램은 `ollamaHost` 설정으로 이를 기본 지원합니다.)

**① 서버 PC (모델을 가진 한 대)**

OS별로 Ollama가 "모든 네트워크에서 접속 허용"하도록 `OLLAMA_HOST` 를 `0.0.0.0` 으로 설정한 뒤 실행합니다.

- **Linux (systemd 서비스)**: `/etc/systemd/system/ollama.service` 의 `[Service]` 에 추가 후 `sudo systemctl daemon-reload && sudo systemctl restart ollama`
  ```ini
  Environment="OLLAMA_HOST=0.0.0.0:11434"
  ```
- **Windows**: 시스템 환경 변수에 `OLLAMA_HOST = 0.0.0.0:11434` 추가 후 로그아웃/재로그인.
- **macOS**: 터미널에서 `launchctl setenv OLLAMA_HOST "0.0.0.0:11434"` 후 Ollama 재시작.

그리고 **방화벽에서 `11434` 포트 인바운드를 허용**하세요. (Ollama에는 자체 로그인 기능이 없으니, 사내망 안에서만 열고 외부로는 절대 노출하지 마세요. 더 안전하게 하려면 SSH 터널이나 사내 VPN 사용을 권장합니다.)

**② 나머지 PC (클라이언트)**

각 PC에는 모델 없이 `ollama-mcp-host` 와 두 도구만 두면 됩니다. 설정 파일의 `ollamaHost` 만 서버 주소로 바꿔 줍니다.
```jsonc
{
  "model": "gemma4:e4b",
  "ollamaHost": "http://192.168.0.10:11434",   // ← 서버 PC의 IP
  ...
}
```
서버가 잘 보이는지는 클라이언트에서 이렇게 확인:
```bash
curl http://192.168.0.10:11434/api/tags     # 모델 목록이 JSON으로 나오면 연결 OK
```

---

### 전략 B. 필요한 것들을 외부에서 받아 내부망에 "서빙"하기

전략 A를 쓰더라도, 최소한 한 번은 외부에서 받아 내부망으로 옮겨야 합니다. 항목별 방법입니다.

| 항목 | 인터넷 되는 곳에서 받기 | 내부망에서 서빙/설치 |
|------|------|------|
| **Node.js** | [nodejs.org](https://nodejs.org) 에서 OS에 맞는 설치 파일 또는 압축본(zip/tar.xz) 다운로드 | 사내 파일서버·공유폴더에 올려 두고 각 PC에서 설치(압축본은 풀어서 PATH에 등록만 하면 됨) |
| **Ollama 본체** | [ollama.com/download](https://ollama.com/download) 에서 설치 파일 다운로드 | 공유폴더로 배포해 설치 |
| **AI 모델** | `ollama pull gemma4:e4b` 후 `~/.ollama/models` 폴더 통째로 복사 | 아래 *모델 옮기기* 참고 |
| **소스코드 3종** | `git clone` 하거나 GitHub 페이지의 *Download ZIP* | 사내 Git(GitLab·Gitea)에 미러하거나, ZIP을 공유폴더로 |
| **npm 패키지** | `npm pack` 으로 `.tgz` 만들기, 또는 사내 npm 미러 구축 | 아래 *npm 패키지 옮기기* 참고 |

**모델 옮기기** — 모델은 그냥 파일입니다.
```bash
# 인터넷 되는 PC
ollama pull gemma4:e4b
tar -czf gemma4-e4b.tar.gz -C ~/.ollama models   # 모델 폴더(manifests+blobs)를 압축

# 내부망 PC (또는 전략 A의 서버 한 대)
tar -xzf gemma4-e4b.tar.gz -C ~/.ollama          # 같은 위치에 풀기
ollama list                                       # gemma4:e4b 가 보이면 성공
```
- 모델을 사내 공유 디스크(NFS/SMB)에 두고 여러 PC가 함께 보게 하려면, 그 경로를 가리키며 실행: `OLLAMA_MODELS=/공유/경로/models ollama serve`
- ⚠️ 전송 중 파일이 깨지면 Ollama가 조용히 실패하거나 이상한 답을 냅니다. 옮긴 뒤 **SHA-256 체크섬으로 무결성을 확인**하세요.

**npm 패키지 옮기기** — 두 가지 중 택1.
- *간단한 방법(tgz)*: 인터넷 되는 곳에서 `npm pack ollama-mcp-host` 하면 `.tgz` 파일이 생깁니다. 내부망에서 `npm install -g ./ollama-mcp-host-0.1.0.tgz` 로 설치. 두 도구는 `node_modules` 까지 설치를 끝낸 폴더를 통째로 복사하면 됩니다.
- *제대로 된 방법(사내 npm 미러)*: 인터넷 경계에 [Verdaccio](https://verdaccio.org) 같은 사내 npm 레지스트리를 한 번 세워 두면, 내부망 PC에서 `npm config set registry http://사내미러주소` 후 평소처럼 `npm install` 하면 됩니다. 패키지가 많아질수록 이쪽이 편합니다.

> 정리하면 — 무거운 **AI 모델은 전략 A로 서버 한 대에 모으고**, 가벼운 **프로그램·도구는 전략 B(tgz 또는 사내 미러)로 각 PC에 배포**하는 조합이 가장 현실적입니다.

---

### ★ 내부망에서 가장 흔한 실패: 방화벽 (`law.go.kr`)

법령 검색 도구(`korean-law-mcp`)는 실제 법령을 가져올 때 **법제처 서버(`law.go.kr`)에 인터넷으로 접속**합니다. 내부망이 이 주소로 나가는 통신(아웃바운드)을 막아 두면:

> "도구 호출은 되는데(↳ 표시는 뜨는데) 법령 내용이 안 옴"

이런 증상이 납니다. 이럴 땐 전산 담당자에게 **`law.go.kr` 아웃바운드 허용**을 요청하세요. (방화벽을 열기 어렵다면, 인터넷 경계에 사내 프록시를 두고 그쪽으로 우회하는 방법도 있습니다.)

(문서 도구 `kordoc` 은 외부 통신을 전혀 안 하고 내 컴퓨터 파일만 다루므로 방화벽과 무관합니다.)

> 💡 런타임은 **Node 하나면 충분**합니다 — 이 프로그램과 두 도구 모두 Node로 돌아가서 파이썬 등을 추가로 깔 필요가 없고, 이 프로그램의 외부 라이브러리도 딱 하나(`@modelcontextprotocol/sdk`)뿐이라 반입이 가볍습니다.

---

## 🩺 문제가 생겼을 때

| 이런 증상이면 | 원인은 이것 | 이렇게 하세요 |
|------|------|------|
| AI가 도구를 안 쓰고 말로만 둘러댐 | thinking 모델 문제거나, 모델이 도구 미지원 | 이 프로그램은 자동 처리됨. 그래도 안 되면 `ollama show 모델명` 으로 `tools` 있는지 확인 |
| `Ollama 연결 실패` | Ollama가 안 켜져 있음 | 다른 터미널에서 `ollama serve` 실행 후 다시 시도 |
| `MCP 서버 '...' 연결 실패` | 설정의 경로가 틀렸거나 도구를 빌드 안 함 | `args` 경로가 실제 파일을 가리키는지, `npm run build` 했는지 확인 |
| 도구는 부르는데 법령이 안 옴 (`✗` 표시) | 법제처 키 누락/오타, 또는 방화벽 | `LAW_OC` 키 확인, 내부망이면 `law.go.kr` 차단 여부 확인 |
| 한글이 깨져 보임 | 터미널 인코딩 | UTF-8 지원 터미널 사용 (Windows Terminal 등) |

---

## 🧑‍💻 개발자용: 다른 프로그램 안에서 불러 쓰기

CLI 말고 코드에서 직접 쓰고 싶다면 라이브러리로 제공됩니다.

```ts
import { McpHost, loadConfig } from "ollama-mcp-host";

const host = new McpHost(loadConfig("mcp.config.json"));
await host.connect();

const messages = [{ role: "user", content: "개인정보보호법 제15조 알려줘" }];
const updated = await host.chat(messages, {
  onToolCall: (i) => console.log(`도구 호출: ${i.server}.${i.tool}`),
});
console.log(updated.at(-1)?.content);

await host.close();
```

소스에서 직접 빌드:
```bash
git clone https://github.com/chrisryugj/ollama-mcp-host.git
cd ollama-mcp-host
npm install && npm run build
npm test          # 단위 테스트
```

### CLI 옵션
| 옵션 | 설명 |
|------|------|
| `-c, --config <path>` | 설정 파일 경로 (기본 `mcp.config.json`) |
| `-m, --model <tag>` | 설정의 모델을 일시적으로 바꿔 실행 |
| `--once "<질문>"` | 대화창 없이 질문 하나만 처리하고 종료 (스크립트용) |
| `-h, --help` | 도움말 |

### 설정 파일 참고
- `"${VAR}"` 형태는 실행 시 환경변수 값으로 자동 치환됩니다 (예: `"${LAW_OC}"` → 실제 키). 덕분에 키를 파일에 직접 안 적어도 됩니다.
- 두 도구에 같은 이름의 기능이 있으면 자동으로 `서버명__기능명` 으로 구분해 충돌을 막습니다.
- npm으로 설치한 MCP라면 `"command": "npx", "args": ["-y", "korean-law-mcp"]` 처럼 써도 됩니다(오프라인에선 절대경로 권장).

---

## 검증 환경

`gemma4:e4b` (Ollama 0.30) + `korean-law-mcp` 4.4.2 + `kordoc` 3.5.1, Node 26 / macOS 에서 두 도구 동시 구동 및 실제 호출(법령 검색·HWPX 생성)을 확인했습니다.

## 라이선스

MIT
