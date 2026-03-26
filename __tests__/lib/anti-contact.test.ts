import { filterMessage, detectViolation } from "@/lib/anti-contact";

describe("filterMessage", () => {
  it("censors Italian mobile numbers", () => {
    expect(filterMessage("chiamami al 3331234567")).toContain("***");
  });
  it("censors international numbers", () => {
    expect(filterMessage("+39 333 123 4567 grazie")).toContain("***");
  });
  it("censors emails", () => {
    expect(filterMessage("scrivimi a mario@gmail.com")).toContain("***");
  });
  it("censors URLs with https", () => {
    expect(filterMessage("vai su https://example.com")).toContain("***");
  });
  it("censors www URLs", () => {
    expect(filterMessage("vai su www.example.com")).toContain("***");
  });
  it("censors @handles", () => {
    expect(filterMessage("trovami su @mario_rossi")).toContain("***");
  });
  it("censors social platform names", () => {
    expect(filterMessage("scrivimi su WhatsApp")).toContain("***");
  });
  it("does not alter clean messages", () => {
    const msg = "Arrivo alle 10 in punto, grazie!";
    expect(filterMessage(msg)).toBe(msg);
  });
});

describe("detectViolation", () => {
  it("returns true when phone number present", () => {
    expect(detectViolation("3331234567")).toBe(true);
  });
  it("returns false for clean text", () => {
    expect(detectViolation("tutto ok grazie")).toBe(false);
  });
});
