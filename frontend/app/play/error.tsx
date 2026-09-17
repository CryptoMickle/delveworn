"use client";

import { DescentFailureBoundary } from "../descent/failure-boundary";
import { descentFailureReport } from "../descent/failure";

export default function PlayError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <DescentFailureBoundary error={error} retry={retry} createReport={caught => descentFailureReport(caught,() => window.localStorage)} />;
}
