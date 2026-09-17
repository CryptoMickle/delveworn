import Image from "next/image";
import Link from "next/link";

export function GameLogo({ compact = false, className = "", onHome }: { compact?: boolean; className?: string; onHome?: () => void }) {
  return (
    <Link
      href="/"
      aria-label="Delveworn home · under development"
      title="Back to home"
      onClick={onHome}
      className={`delveworn-home delveworn-brand-logo${compact ? " delveworn-brand-compact" : ""} ${className}`}
    >
      <Image
        src="/assets/delveworn-logo-v1.png"
        width={2172}
        height={724}
        alt=""
        aria-hidden="true"
        loading="eager"
        sizes={compact ? "(max-width: 800px) 96px, (max-width: 1199px) 168px, (max-height: 799px) 168px, 252px" : "(max-width: 800px) 240px, 300px"}
      />
      <span className="delveworn-development-tag">UNDER DEVELOPMENT</span>
    </Link>
  );
}
