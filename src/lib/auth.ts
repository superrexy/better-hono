import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, openAPI } from "better-auth/plugins";
import { createDrizzle, type RawDatabase } from "@/db";
import * as schema from "@/db/schema";
import { sendMail } from "@/lib/mailer";
import { DEFAULT_ROLE } from "@/lib/permissions";
import { Environment } from "@/env";

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = Auth["$Infer"]["Session"]["user"];
export type AuthSession = Auth["$Infer"]["Session"]["session"];

const OTP_SUBJECTS = {
  "sign-in": "Your sign-in code",
  "email-verification": "Verify your email",
  "forget-password": "Reset your password",
  "change-email": "Confirm your new email",
} as const;

export const createAuth = (env: Environment, db: RawDatabase = createDrizzle(env)) => {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      // Relations v2 leaves `db._.fullSchema` empty, so the adapter needs the
      // tables handed to it explicitly; its schema check reads this first.
      schema,
    }),
    /**
     * `roleId` is not a better-auth field, so sign-up leaves it undefined and
     * the column default applies. Rejections here surface as 400 responses.
     */
    user: {
      additionalFields: {
        roleId: {
          type: "string",
          required: false,
          input: false,
          defaultValue: DEFAULT_ROLE,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      // OTP sign-in sets `emailVerified`, so password sign-up can start verified.
      requireEmailVerification: false,
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        // `hashed` uses scrypt, which stalls the Workers runtime; `encrypted`
        // keeps the stored code unreadable without the auth secret.
        storeOTP: "encrypted",
        // Anyone can request a code; the account is created on verify.
        disableSignUp: false,
        async sendVerificationOTP({ email, otp, type }) {
          await sendMail(env, {
            to: email,
            subject: OTP_SUBJECTS[type],
            text: `Your code is ${otp}. It expires in 5 minutes.`,
          });
        },
      }),
      openAPI(),
    ],
  });
};
