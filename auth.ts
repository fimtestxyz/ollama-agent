import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { ANON_USER_ID } from "@/lib/constants";

export function isAuthConfigured(): boolean {
  return !!(
    process.env.AUTH_SECRET &&
    (process.env.GITHUB_ID || process.env.AUTH_GITHUB_ID) &&
    (process.env.GITHUB_SECRET || process.env.AUTH_GITHUB_SECRET)
  );
}

export { ANON_USER_ID };

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || process.env.GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
