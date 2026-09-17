export function stripAnalyticsUrlDetails(url: string): string {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const firstDetailIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .reduce((first, index) => Math.min(first, index), url.length);

  return url.slice(0, firstDetailIndex);
}

export function sanitizeAnalyticsEvent<T extends { url: string }>(event: T): T {
  return {
    ...event,
    url: stripAnalyticsUrlDetails(event.url),
  };
}
