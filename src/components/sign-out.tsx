import { signOut } from "@/auth";

export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button className="text-button" type="submit">
        Sign out
      </button>
    </form>
  );
}
