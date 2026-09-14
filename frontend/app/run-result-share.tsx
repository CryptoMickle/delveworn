"use client";

import { useRef, useState } from "react";

type ClipboardWriter = Pick<Clipboard, "writeText">;

/** Copy exactly the caller's result; clipboard access may itself be blocked. */
export async function copyResultToClipboard(
  text: string,
  getClipboard: () => ClipboardWriter = () => navigator.clipboard,
): Promise<boolean> {
  try {
    await getClipboard().writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The caller supplies the result and its trust boundary; this component adds no claims. */
export function RunResultShare({ text, label = "COPY RESULT" }: { text: string; label?: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ text: string; copied: boolean } | null>(null);
  const pendingRef = useRef(false);
  const currentResult = result?.text === text ? result : null;

  const copy = async () => {
    if (pendingRef.current || !text.trim()) return;
    pendingRef.current = true;
    setPending(true);
    const copied = await copyResultToClipboard(text);
    setResult({ text, copied });
    pendingRef.current = false;
    setPending(false);
  };

  return (
    <div className="run-result-share mt-3 w-full">
      <button
        type="button"
        onClick={() => void copy()}
        disabled={pending || !text.trim()}
        className="min-h-11 w-full rounded-xl border border-zinc-600 px-4 py-3 font-bold transition hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "COPYING…" : label}
      </button>
      <p className="mt-2 min-h-4 text-xs text-amber-200" role="status" aria-live="polite">
        {currentResult?.copied
          ? "Result copied. Share it wherever you like."
          : currentResult
            ? "Clipboard access is unavailable. Select and copy the result below."
            : ""}
      </p>
      {currentResult && !currentResult.copied && (
        <textarea
          aria-label="Result text to copy"
          readOnly
          value={text}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3 min-h-40 w-full rounded-lg border border-zinc-600 bg-black p-3 text-left text-xs text-zinc-200"
        />
      )}
    </div>
  );
}
