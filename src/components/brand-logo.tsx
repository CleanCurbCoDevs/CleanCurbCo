import Image from "next/image";
import Link from "next/link";
import { brand } from "@/lib/site";

export function BrandLogo() {
  return (
    <Link href="/" className="brand-logo" aria-label="Clean Curb Co. home">
      <span className="brand-image-frame" aria-hidden="true">
        <Image
          src="/clean-curb-logo.png"
          alt={brand.logoAlt}
          width={72}
          height={72}
          className="brand-logo-image"
        />
      </span>
      <span className="brand-text">
        <span className="brand-name">{brand.name}</span>
        <span className="brand-tagline">{brand.tagline}</span>
      </span>
    </Link>
  );
}
