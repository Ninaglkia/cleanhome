import { validateRegistration, isValidEmail } from "../lib/validation";

describe("isValidEmail", () => {
  it.each(["a@b.co", "mario.rossi@example.com", "x+y@dom.io"])("accepts %s", (e) => {
    expect(isValidEmail(e)).toBe(true);
  });
  it.each(["", "nope", "a@b", "a b@c.com", "@x.com", "x@.com"])("rejects %s", (e) => {
    expect(isValidEmail(e)).toBe(false);
  });
});

describe("validateRegistration — login/signup flow", () => {
  const ok = { fullName: "Mario Rossi", email: "mario@example.com", password: "secret12" };

  it("accepts a fully valid input", () => {
    expect(validateRegistration(ok)).toEqual({ valid: true });
  });

  it("rejects a name shorter than 2 chars", () => {
    const r = validateRegistration({ ...ok, fullName: "M" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.title).toBe("Errore");
  });

  it("rejects an invalid email", () => {
    const r = validateRegistration({ ...ok, email: "not-an-email" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.title).toBe("Email non valida");
  });

  it("rejects a password under 8 chars", () => {
    const r = validateRegistration({ ...ok, password: "ab1" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.title).toBe("Password troppo corta");
  });

  it("rejects a password with no digit", () => {
    const r = validateRegistration({ ...ok, password: "onlyletters" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.title).toBe("Password debole");
  });

  it("rejects a password with no letter", () => {
    const r = validateRegistration({ ...ok, password: "12345678" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.title).toBe("Password debole");
  });

  it("trims and lowercases email before validating", () => {
    expect(validateRegistration({ ...ok, email: "  MARIO@EXAMPLE.COM " })).toEqual({ valid: true });
  });
});
