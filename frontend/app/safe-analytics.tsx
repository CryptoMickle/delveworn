"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { sanitizeAnalyticsEvent } from "./analytics-url";

const beforeSend: BeforeSend = (event) => sanitizeAnalyticsEvent(event);

export function SafeAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
