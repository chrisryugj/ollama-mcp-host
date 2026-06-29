# ollama-mcp-host — 호스트 + 법령/문서 MCP 서버를 한 이미지에 담는다.
# (Ollama 엔진은 별도 컨테이너 — docker-compose.yml 참고)
FROM node:20-slim

# 호스트와 두 MCP 서버를 npm 레지스트리에서 전역 설치한다.
# 전역 bin(korean-law-mcp, kordoc-mcp, ollama-mcp-host)이 PATH 에 등록되어
# 설정의 command 로 바로 호출된다. 버전을 고정해 재현성을 확보한다.
RUN npm install -g \
      ollama-mcp-host@0.1.2 \
      korean-law-mcp@4.4.3 \
      kordoc@3.5.2

WORKDIR /app

# 도커용 설정 (ollamaHost 가 ollama 컨테이너를 가리킴)
COPY mcp.config.docker.json ./mcp.config.json

# 대화형 CLI 로 실행. 배치로 쓰려면 compose 에서 --once 를 덧붙인다.
ENTRYPOINT ["ollama-mcp-host", "-c", "mcp.config.json"]
