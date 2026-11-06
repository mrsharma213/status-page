import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { envFrom } from "./lib/env";
import { loginStatus, secretsEqual } from "./lib/secrets";

const SESSION_SECONDS = 60 * 60 * 12;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_SECONDS },
  jwt: { maxAge: SESSION_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Owner password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const env = envFrom(process.env);
        if (loginStatus(env) !== "ok" || !env.ownerPassword) return null;
        const password = credentials?.password;
        if (typeof password !== "string") return null;
        if (!secretsEqual(password, env.ownerPassword)) return null;
        return { id: "owner", name: "Owner" };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = "owner";
        token.purpose = "read";
      }
      return token;
    },
    session({ session, token }) {
      if (token.purpose !== "read" || token.role !== "owner") {
        return { expires: session.expires };
      }
      session.purpose = "read";
      if (session.user) session.user.name = "Owner";
      return session;
    },
  },
});
