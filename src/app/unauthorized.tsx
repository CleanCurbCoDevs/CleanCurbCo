import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="section section-cream">
      <div className="container shell-layout">
        <section className="placeholder-panel">
          <p className="section-kicker">Login Required</p>
          <h1>Please sign in.</h1>
          <p>
            Your session is missing or expired. Sign in again to continue.
          </p>
          <div className="action-row">
            <Link className="button button-dark" href="/login">
              Customer Login
            </Link>
            <Link className="button button-outline" href="/employee-login">
              Employee Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
