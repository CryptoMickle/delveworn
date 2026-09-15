export const DEFAULT_PUBLIC_DEPLOYMENT = "somniaShannon" as const;

export function isSomniaDeployment(deployment: string | undefined): boolean {
  return (deployment ?? DEFAULT_PUBLIC_DEPLOYMENT) === "somniaShannon";
}
