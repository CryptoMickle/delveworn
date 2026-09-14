/** Canonical links stay stable on preview hosts and separate chain deployments. */
export function getSiteOrigin(deployment: string | undefined, configuredOrigin?: string): string {
  const value = configuredOrigin?.trim() || (deployment === "somniaShannon"
    ? "https://delveworn-somnia.vercel.app"
    : "https://delveworn.app");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTP or HTTPS URL.");
  }
  return url.origin;
}

export const SITE_ORIGIN = getSiteOrigin(
  process.env.NEXT_PUBLIC_DEPLOYMENT,
  process.env.NEXT_PUBLIC_SITE_URL,
);

export function siteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).href;
}
