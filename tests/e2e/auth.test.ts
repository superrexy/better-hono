import { describe, expect, test } from "bun:test";
import { get, post } from "../helpers/app";
import { createUser, currentOtp, TEST_PASSWORD, uniqueEmail } from "../helpers/fixtures";

describe("authentication", () => {
  test("password sign-in returns a session that /api/me accepts", async () => {
    const user = await createUser({ role: "user" });

    const me = await get("/api/me", { cookie: user.cookie });

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);
    expect(me.body.role).toBe("user");
    expect(me.body.permissions).toEqual(["users:read"]);
    expect(me.body.session.id).toBeString();
  });

  test("OTP request stores a code and OTP sign-in creates the account", async () => {
    const email = uniqueEmail("otp");

    const requested = await post("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    });
    expect(requested.status).toBe(200);
    expect(requested.body).toEqual({ success: true });

    const otp = await currentOtp(email);
    expect(otp).toMatch(/^\d{6}$/);

    const signIn = await post("/api/auth/sign-in/email-otp", {
      body: { email, otp, name: "OTP User" },
    });
    expect(signIn.status).toBe(200);
    expect(signIn.cookie).toContain("session_token");
    expect(signIn.body.user.email).toBe(email);

    const me = await get("/api/me", { cookie: signIn.cookie });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
    // New accounts land on the default role.
    expect(me.body.role).toBe("user");
  });

  test("a wrong OTP is rejected", async () => {
    const email = uniqueEmail("otp-wrong");

    await post("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    });

    const signIn = await post("/api/auth/sign-in/email-otp", {
      body: { email, otp: "000000" },
    });

    expect(signIn.status).toBe(400);
    expect(signIn.cookie).toBeEmpty();
  });

  test("wrong password is rejected", async () => {
    const user = await createUser({ role: "user" });

    const signIn = await post("/api/auth/sign-in/email", {
      body: { email: user.email, password: TEST_PASSWORD + "x" },
    });

    expect(signIn.status).toBe(401);
    expect(signIn.cookie).toBeEmpty();
  });

  test("sign-out invalidates the session for /api/me", async () => {
    const user = await createUser({ role: "user" });

    const signedOut = await post("/api/auth/sign-out", {
      cookie: user.cookie,
      body: {},
    });
    expect(signedOut.status).toBe(200);

    const me = await get("/api/me", { cookie: user.cookie });
    expect(me.status).toBe(401);
  });
});
