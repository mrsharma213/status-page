import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Wordmark } from "@/components/wordmark";
import { loginAction } from "./actions";
import { loginStatus } from "@/lib/secrets";
import { currentEnv } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (session?.user && session.purpose === "read") redirect("/");

  const params = await searchParams;
  const configured = loginStatus(currentEnv()) === "ok";
  const errorCode = params.error === "rejected" || params.error === "unconfigured" ? params.error : null;
  const message = !configured || errorCode === "unconfigured"
    ? "Sign-in is not configured on this deployment."
    : errorCode === "rejected"
      ? "That password was not accepted."
      : null;

  return (
    <main className="page">
      <header className="login-top">
        <div>
          <Wordmark />
          <p className="eyebrow">Bot work</p>
        </div>
      </header>
      <h1>Sign in</h1>
      <p className="lead">Private board. The password opens the owner session. No work is shown on this screen.</p>
      <form className="login-card" action={loginAction}>
        <label>
          <span className="kicker">Password</span>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="primary" type="submit">
          Sign in
        </button>
        {message ? (
          <p className="error" role="alert">
            {message}
          </p>
        ) : null}
      </form>
    </main>
  );
}
