"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { loginStatus } from "@/lib/secrets";
import { currentEnv } from "@/lib/server/runtime";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(formData: FormData) {
  if (loginStatus(currentEnv()) !== "ok") redirect("/login?error=unconfigured");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { password, redirectTo: "/" });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuthError) redirect("/login?error=rejected");
    redirect("/login?error=unconfigured");
  }
}
