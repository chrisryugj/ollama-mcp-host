import { describe, it, expect } from "vitest";
import { normalizeSchema, parseArgs, extractText, cleanEnv } from "../src/util.js";

describe("normalizeSchema", () => {
  it("object 스키마는 그대로 둔다", () => {
    const s = { type: "object", properties: { city: { type: "string" } } };
    expect(normalizeSchema(s)).toEqual(s);
  });

  it("type 누락 시 object 로 감싼다", () => {
    const out = normalizeSchema({ properties: { x: { type: "string" } } });
    expect(out.type).toBe("object");
    expect(out.properties).toEqual({ x: { type: "string" } });
  });

  it("null/undefined 는 빈 object 스키마", () => {
    expect(normalizeSchema(undefined)).toEqual({ type: "object", properties: {} });
    expect(normalizeSchema(null)).toEqual({ type: "object", properties: {} });
  });
});

describe("parseArgs", () => {
  it("객체는 그대로", () => {
    expect(parseArgs({ city: "서울" })).toEqual({ city: "서울" });
  });
  it("JSON 문자열은 파싱", () => {
    expect(parseArgs('{"city":"서울"}')).toEqual({ city: "서울" });
  });
  it("빈 문자열/깨진 JSON 은 빈 객체", () => {
    expect(parseArgs("")).toEqual({});
    expect(parseArgs("not json")).toEqual({});
  });
});

describe("extractText", () => {
  it("text content 만 합친다", () => {
    expect(
      extractText([
        { type: "text", text: "법령" },
        { type: "text", text: "조문" },
      ])
    ).toBe("법령\n조문");
  });
  it("비텍스트는 placeholder", () => {
    expect(extractText([{ type: "image" }])).toBe("[image content]");
  });
  it("없으면 빈 문자열", () => {
    expect(extractText(undefined)).toBe("");
  });
});

describe("cleanEnv", () => {
  it("undefined 값을 제거한다", () => {
    expect(cleanEnv({ A: "1", B: undefined, C: "3" })).toEqual({ A: "1", C: "3" });
  });
});
