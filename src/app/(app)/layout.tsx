import Link from "next/link";
import { Nav } from "@/components/Nav";
import { logout } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const hasPassword = Boolean(process.env.APP_PASSWORD);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark">
          <span className="wordmark-dot" /> AURA
        </Link>
        <Nav />
        <div className="sidebar-foot">
          {hasPassword ? (
            <form action={logout}>
              <button className="btn btn-ghost btn-sm" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
