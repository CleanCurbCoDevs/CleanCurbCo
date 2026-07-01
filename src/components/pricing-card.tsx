import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

type PricingCardProps = {
  label: string;
  name: string;
  price: string;
  suffix: string;
  frequency: string;
  highlights: string[];
  ctaHref: string;
  ctaLabel: string;
  featured?: boolean;
};

export function PricingCard({
  label,
  name,
  price,
  suffix,
  frequency,
  highlights,
  ctaHref,
  ctaLabel,
  featured,
}: PricingCardProps) {
  return (
    <article className={`card pricing-card${featured ? " featured" : ""}`}>
      <span className="plan-badge">{name}</span>
      <div>
        <h3>{label}</h3>
        <p>{frequency}</p>
      </div>
      <div className="price">
        <strong>{price}</strong>
        <span>{suffix}</span>
      </div>
      <ul className="check-list">
        {highlights.map((item) => (
          <li key={item}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        className={`button ${featured ? "button-primary" : "button-dark"}`}
        href={ctaHref}
      >
        {ctaLabel}
      </Link>
    </article>
  );
}
