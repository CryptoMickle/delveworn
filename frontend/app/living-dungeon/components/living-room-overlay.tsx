"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./intent-to-world.module.css";

export type LivingRoomHotspot = Readonly<{
  id: string;
  name: string;
  x: number;
  y: number;
  kind?: "object" | "hazard" | "witness" | "exit";
  icon?: string;
  description?: string;
  selected?: boolean;
}>;

export type LivingRoomPlanPoint = Readonly<{
  id: string;
  x: number;
  y: number;
  label: string;
}>;

export type LivingRoomObserverFootprint = Readonly<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  detail?: string;
}>;

export type LivingRoomOverlayProps = Readonly<{
  roomLabel: string;
  premise?: Readonly<{ name: string; description?: string }> | null;
  hotspots: readonly LivingRoomHotspot[];
  planPath?: readonly LivingRoomPlanPoint[];
  observerFootprint?: LivingRoomObserverFootprint | null;
  onHotspotSelect?: (hotspotId: string) => void;
  children?: ReactNode;
  className?: string;
}>;

function bounded(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function positionStyle(x: number, y: number): CSSProperties {
  return {
    "--hotspot-x": `${bounded(x)}%`,
    "--hotspot-y": `${bounded(y)}%`,
  } as CSSProperties;
}

export function LivingRoomOverlay({
  roomLabel,
  premise = null,
  hotspots,
  planPath = [],
  observerFootprint = null,
  onHotspotSelect,
  children,
  className,
}: LivingRoomOverlayProps) {
  const polyline = planPath.map(point => `${bounded(point.x)},${bounded(point.y)}`).join(" ");
  const observerStyle = observerFootprint ? {
    "--observer-x": `${bounded(observerFootprint.x)}%`,
    "--observer-y": `${bounded(observerFootprint.y)}%`,
    "--observer-width": `${Math.max(6, Math.min(100, observerFootprint.width ?? 28))}%`,
    "--observer-height": `${Math.max(6, Math.min(100, observerFootprint.height ?? 22))}%`,
  } as CSSProperties : undefined;

  return <figure
    className={`${styles.surface} ${styles.roomOverlay}${className ? ` ${className}` : ""}`}
    aria-label={roomLabel}
    data-keyboard-actions
  >
    <div className={styles.roomContent}>{children}</div>

    {premise && <figcaption className={styles.premisePlaque}>
      <span>Selected premise</span>
      <strong>{premise.name}</strong>
      {premise.description && <p>{premise.description}</p>}
    </figcaption>}

    {planPath.length > 0 && <>
      <svg className={styles.planSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {planPath.length > 1 && <polyline className={styles.planLine} points={polyline} />}
        {planPath.map((point, index) => <g key={point.id}>
          <circle className={styles.planNode} cx={bounded(point.x)} cy={bounded(point.y)} r="2.8" />
          <text className={styles.planNumber} x={bounded(point.x)} y={bounded(point.y)}>{index + 1}</text>
        </g>)}
      </svg>
      <ol className={styles.visuallyHidden} aria-label="Planned path">
        {planPath.map((point, index) => <li key={point.id}>{index + 1}. {point.label}</li>)}
      </ol>
    </>}

    {observerFootprint && <>
      <div className={styles.observerArea} style={observerStyle} aria-hidden="true" />
      <div className={styles.observerTag} style={observerStyle} role="note" aria-label={observerFootprint.detail
        ? `${observerFootprint.label}: ${observerFootprint.detail}`
        : observerFootprint.label}>
        <span aria-hidden="true">◉ </span>{observerFootprint.label}
      </div>
    </>}

    {hotspots.map((hotspot, index) => {
      const content = <>
        <span className={styles.hotspotDot} aria-hidden="true">{hotspot.icon ?? "✦"}</span>
        <span>{hotspot.name}</span>
      </>;
      const title = hotspot.description ? `${hotspot.name}: ${hotspot.description}` : hotspot.name;
      return onHotspotSelect
        ? <button
          key={hotspot.id}
          type="button"
          className={styles.hotspot}
          data-kind={hotspot.kind ?? "object"}
          data-selected={hotspot.selected || undefined}
          style={positionStyle(hotspot.x, hotspot.y)}
          aria-label={title}
          aria-pressed={hotspot.selected}
          data-keyboard-default={planPath.length === 0 && index === 0 ? "true" : undefined}
          onClick={() => onHotspotSelect(hotspot.id)}
        >{content}</button>
        : <span
          key={hotspot.id}
          className={styles.hotspot}
          data-kind={hotspot.kind ?? "object"}
          data-selected={hotspot.selected || undefined}
          style={positionStyle(hotspot.x, hotspot.y)}
          role="img"
          aria-label={title}
        >{content}</span>;
    })}
  </figure>;
}
