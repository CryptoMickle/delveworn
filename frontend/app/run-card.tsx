"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createRunCardModel, renderRunCard, RUN_CARD_HEIGHT, RUN_CARD_WIDTH, type RunCardData, type RunCardModel } from "./run-card-render";
import styles from "./run-card.module.css";

export type { RunCardData } from "./run-card-render";

export function RunCard({ data, copyAction }: { data: RunCardData; copyAction?: ReactNode }) {
  const model = createRunCardModel(data);
  const modelKey = JSON.stringify(model);
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState<{ key: string; src: string } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [notice, setNotice] = useState<{ key: string; message: string } | null>(null);
  const requestKey = `${modelKey}:${attempt}`;
  const currentImage = image?.key === requestKey ? image.src : null;
  const currentError = error?.key === requestKey ? error.message : null;

  useEffect(() => {
    let cancelled = false;
    const retryToken = attempt > 0 ? `${attempt}-${Date.now()}` : undefined;
    void renderRunCard(JSON.parse(modelKey) as RunCardModel, retryToken).then(src => {
      if (!cancelled) setImage({ key: requestKey, src });
    }).catch(() => {
      if (!cancelled) setError({ key: requestKey, message: "The run card could not be created. Your result is safe; retry the image below." });
    });
    return () => { cancelled = true; };
  }, [attempt, modelKey, requestKey]);

  const save = () => {
    if (!currentImage) return;
    const link = document.createElement("a");
    try {
      link.href = currentImage;
      link.download = model.filename;
      document.body.appendChild(link);
      link.click();
      setNotice({ key: requestKey, message: "Image download requested. Your browser chooses where to save it." });
    } catch {
      setNotice({ key: requestKey, message: "The image could not be saved. Try SAVE IMAGE again." });
    } finally {
      link.remove();
    }
  };

  return (
    <section className={`run-card-panel ${styles.panel}`} aria-label="Shareable Delveworn run card">
      <div className={styles.heading}><span>YOUR DELVEWORN RUN CARD</span><h3>ROOM {model.room} · {model.enemies} ENEMIES DEFEATED</h3></div>
      <div className={styles.preview}>
        {currentImage ? (
          // This data URL is the export itself; image optimization would alter it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentImage} width={RUN_CARD_WIDTH} height={RUN_CARD_HEIGHT} alt={model.alt} />
        ) : <div className={styles.placeholder} aria-hidden="true"><strong>DELVEWORN</strong><span>Room {model.room} reached</span></div>}
      </div>
      <p className={styles.disclosure}>{data.mode === "practice" ? "Local practice · self-reported result · no onchain rewards" : model.disclosure}</p>
      <div className={styles.actions} data-keyboard-actions data-has-copy={Boolean(copyAction)}>
        <button type="button" onClick={save} disabled={!currentImage}>SAVE IMAGE <span aria-hidden="true">↓</span></button>
        {copyAction}
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {currentError || (notice?.key === requestKey ? notice.message : currentImage ? "1200 × 675 PNG · ready to save" : "Preparing your run card…")}
      </p>
      {currentError && <button className={styles.retry} type="button" data-keyboard-actions onClick={() => setAttempt(value => value + 1)}>RETRY IMAGE</button>}
    </section>
  );
}
