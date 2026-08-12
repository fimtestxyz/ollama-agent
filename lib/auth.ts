import { auth, isAuthConfigured, ANON_USER_ID } from "@/auth";

export class AuthError extends Error {}

/**
 * Resolve the acting user id for a server-side request.
 * - Anonymous mode (OAuth not configured): everyone is the "local" user.
 * - Configured mode: requires a valid session; throws AuthError otherwise.
 */
export async function getUserId(): Promise<string> {
  if (!isAuthConfigured()) return ANON_USER_ID;
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new AuthError("Unauthorized");
  return id;
}
