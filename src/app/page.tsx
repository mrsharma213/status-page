import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Dashboard } from "@/components/dashboard";
import { SignOutForm } from "@/components/sign-out";
import { Wordmark } from "@/components/wordmark";
import { loadBoard } from "@/lib/server/load-board";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  await connection();
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (!session?.user || session.purpose !== "read") redirect("/login");
  const model = await loadBoard();
  return (
    <main className="page">
      <header className="topbar">
        <div>
          <Wordmark />
          <p className="eyebrow">Bot work</p>
        </div>
        <SignOutForm />
      </header>
      <Dashboard model={model} />
    </main>
  );
}
