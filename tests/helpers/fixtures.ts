import { db, runtime } from "./runtime";
import { post } from "./app";
import { DEFAULT_ROLE } from "@/lib/permissions";
import type { RoleName } from "@/lib/permissions";

/**
 * Every fixture gets its own email, so tests never collide and can run
 * concurrently against one database. Nothing is truncated between tests.
 */
export function uniqueEmail(tag: string): string {
  return `${tag}-${crypto.randomUUID()}@example.test`;
}

export const TEST_PASSWORD = "password-12345678";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: RoleName;
  /** Cookie pair for authenticated requests. */
  cookie: string;
}

export interface CreateUserOptions {
  role?: RoleName;
  name?: string;
}

/**
 * Creates a user through better-auth (so the `account` row is real), sets the
 * role on the user row, then signs in over HTTP to obtain a session cookie.
 */
export async function createUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const role = options.role ?? DEFAULT_ROLE;
  const email = uniqueEmail(role);
  const name = options.name ?? "Test User";

  const created = await runtime.auth.api.signUpEmail({
    body: { email, password: TEST_PASSWORD, name },
  });

  await db.user.update({ where: { id: created.user.id }, data: { roleId: role } });

  const signIn = await post("/api/auth/sign-in/email", {
    body: { email, password: TEST_PASSWORD },
  });

  if (signIn.status !== 200) {
    throw new Error(`sign-in failed for ${email}: ${signIn.status} ${JSON.stringify(signIn.body)}`);
  }

  return { id: created.user.id, email, password: TEST_PASSWORD, role, cookie: signIn.cookie };
}

export const createAdmin = (options: Omit<CreateUserOptions, "role"> = {}) =>
  createUser({ ...options, role: "admin" });

/** Reads the OTP better-auth stored for this email, instead of scraping logs. */
export async function currentOtp(
  email: string,
  type: "sign-in" | "email-verification" = "sign-in",
): Promise<string> {
  const result = await runtime.auth.api.getVerificationOTP({ query: { email, type } });
  if (!result.otp) throw new Error(`no OTP stored for ${email}`);
  return result.otp;
}
