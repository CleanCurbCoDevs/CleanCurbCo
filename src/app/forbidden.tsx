import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="section section-cream">
      <div className="container shell-layout">
        <section className="placeholder-panel">
          <p className="section-kicker">Protected Area</p>
          <h1>Access denied.</h1>
          <p>
            This Clean Curb Co. area is reserved for authorized team members.
            If you believe your account should have access, contact support.
          </p>
          <div className="action-row">
            <Link className="button button-dark" href="/portal">
              Customer Portal
            </Link>
            <Link className="button button-outline" href="/contact">
              Contact Support
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
