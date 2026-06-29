import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";

function writeTmp(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "omh-"));
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe("loadConfig", () => {
  it("기본 설정을 파싱한다", () => {
    const p = writeTmp(
      "c.json",
      JSON.stringify({
        model: "gemma4:e4b",
        servers: [{ name: "kordoc", command: "node", args: ["dist/mcp.js"] }],
      })
    );
    const cfg = loadConfig(p);
    expect(cfg.model).toBe("gemma4:e4b");
    expect(cfg.servers).toHaveLength(1);
    expect(cfg.servers[0].name).toBe("kordoc");
  });

  it("${ENV} 를 환경변수로 치환한다", () => {
    process.env.TEST_OC_KEY = "my-secret-key";
    const p = writeTmp(
      "c.json",
      JSON.stringify({
        model: "gemma4:e4b",
        servers: [
          { name: "law", command: "node", args: ["x.js"], env: { LAW_OC: "${TEST_OC_KEY}" } },
        ],
      })
    );
    const cfg = loadConfig(p);
    expect(cfg.servers[0].env?.LAW_OC).toBe("my-secret-key");
  });

  it("model 이 없으면 던진다", () => {
    const p = writeTmp("c.json", JSON.stringify({ servers: [] }));
    expect(() => loadConfig(p)).toThrow(/model/);
  });

  it("servers 가 비면 던진다", () => {
    const p = writeTmp("c.json", JSON.stringify({ model: "x", servers: [] }));
    expect(() => loadConfig(p)).toThrow(/servers/);
  });

  it("서버 이름 중복은 던진다", () => {
    const p = writeTmp(
      "c.json",
      JSON.stringify({
        model: "x",
        servers: [
          { name: "a", command: "node" },
          { name: "a", command: "node" },
        ],
      })
    );
    expect(() => loadConfig(p)).toThrow(/중복/);
  });
});
