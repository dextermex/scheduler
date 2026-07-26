import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-wrap">
      <form className="login-card" action={login}>
        <div className="wordmark">
          <span className="wordmark-dot" /> AURA
        </div>
        <h1 className="login-title">Scheduler</h1>
        <p className="login-sub">Enter the team password to continue.</p>
        <input
          className="input"
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          required
        />
        {error ? <p className="form-error">Wrong password — try again.</p> : null}
        <button className="btn btn-primary" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
