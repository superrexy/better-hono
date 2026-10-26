import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.string().url(),
  /** Optional: only needed once a real provider replaces the console mailer. */
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("auth@example.com"),
  /**
   * Bootstrap admin created by `bun run db:seed`. The account is only created
   * when the password is set, so a plain seed never invents a credential.
   */
  SEED_ADMIN_EMAIL: z.string().email().default("superadmin@example.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().default("Super Admin"),
});

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `error: invalid env:\n${Object.entries(error.flatten().fieldErrors).map(([key, errors]) => `${key}: ${errors.join(', ')}`).join('\n')}`;
    throw new Error(errorMessage);
  }
  
  return env;
}
