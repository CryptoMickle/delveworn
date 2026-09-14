export type RunCardData = {
  mode: "practice" | "onchain";
  networkLabel?: string;
  roomsCleared: number;
  gold: number;
  weaponLevel: number;
  armorLevel: number;
  bossesDefeated: number;
  relicName: string;
  uniqueRelics: number;
  totalRelicDrops: number;
};

export const RUN_CARD_WIDTH = 1200;
export const RUN_CARD_HEIGHT = 675;

const count = (value: number) => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("en-US") : "—";

/** Presentation only: the caller supplies every result and its mode. */
export function createRunCardModel(data: RunCardData) {
  const room = Number.isSafeInteger(data.roomsCleared) && data.roomsCleared >= 0 && data.roomsCleared < Number.MAX_SAFE_INTEGER
    ? data.roomsCleared + 1 : null;
  const mode = data.mode === "practice" ? "Practice" : "Onchain";
  const network = data.networkLabel?.trim() || "Network not provided";
  const modeLabel = data.mode === "practice" ? "LOCAL PRACTICE" : `ONCHAIN · ${network}`;
  const disclosure = data.mode === "practice"
    ? "LOCAL PRACTICE · SELF-REPORTED · NO ONCHAIN REWARDS"
    : "Confirmed game snapshot · image is not a proof certificate";
  const result = {
    room: room === null ? "—" : count(room),
    enemies: count(data.roomsCleared), bosses: count(data.bossesDefeated), gold: count(data.gold),
    weapon: count(data.weaponLevel), armor: count(data.armorLevel),
    relic: data.relicName.trim() || "No relic", unique: count(data.uniqueRelics), drops: count(data.totalRelicDrops),
    modeLabel, disclosure,
    filename: `delveworn-${data.mode}-room-${room ?? "unknown"}.png`,
  };
  return {
    ...result,
    alt: `Delveworn ${mode} run card. Room reached ${result.room}; enemies defeated ${result.enemies}; bosses defeated ${result.bosses}; gold remaining ${result.gold}; weapon level ${result.weapon}; armor level ${result.armor}; relic ${result.relic}; ${result.unique} unique relics; ${result.drops} total relic drops. ${modeLabel}. ${disclosure}.`,
  };
}

export type RunCardModel = ReturnType<typeof createRunCardModel>;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    const timer = window.setTimeout(() => finish(new Error("Run-card artwork could not load.")), 10_000);
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Run-card artwork could not load."));
    image.src = src;
  });
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  size: number, color: string, width: number, font = "Arial, Helvetica, sans-serif", weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  let label = value;
  while (ctx.measureText(label).width > width && size > 13) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${font}`;
  }
  if (ctx.measureText(label).width > width) {
    while (label.length && ctx.measureText(`${label}…`).width > width) label = label.slice(0, -1);
    label += "…";
  }
  ctx.fillText(label, x, y);
}

/** The preview and download share this one PNG; no game action waits for it. */
export async function renderRunCard(model: RunCardModel, retryToken?: string): Promise<string> {
  // WebKit can retain a failed image resource. Only an explicit retry changes
  // these same-origin URLs; the initial request keeps normal browser caching.
  const source = (path: string) => retryToken ? `${path}?run-card-retry=${encodeURIComponent(retryToken)}` : path;
  const [logo, art] = await Promise.all([
    loadImage(source("/assets/delveworn-logo-v1.png")),
    loadImage(source("/assets/delveworn-tier2-party-hero.webp")),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = RUN_CARD_WIDTH;
  canvas.height = RUN_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable in this browser.");

  ctx.fillStyle = "#100b18";
  ctx.fillRect(0, 0, 1200, 675);
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.drawImage(art, 305, 0, 960, 540);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, 0, 1200, 130);
  shade.addColorStop(0, "#110b1b");
  shade.addColorStop(0.38, "#110b1bed");
  shade.addColorStop(1, "#110b1b24");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1200, 675);
  const floor = ctx.createLinearGradient(0, 210, 0, 675);
  floor.addColorStop(0, "#130d2000");
  floor.addColorStop(0.58, "#130d20eb");
  floor.addColorStop(1, "#0d0913");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, 1200, 675);

  ctx.strokeStyle = "#67446f";
  ctx.lineWidth = 2;
  rounded(ctx, 18, 18, 1164, 639, 19);
  ctx.stroke();
  ctx.strokeStyle = "#e6a259";
  ctx.lineWidth = 3;
  for (const [x, y, sx, sy] of [[34, 34, 1, 1], [1166, 34, -1, 1], [34, 641, 1, -1], [1166, 641, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + sx * 38, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 38); ctx.stroke();
  }

  ctx.drawImage(logo, 52, 35, 348, 116);
  text(ctx, model.modeLabel, 56, 166, 14, "#d8b4fe", 1075);
  text(ctx, "RUN ENDED · THE STORY STAYS.", 57, 207, 16, "#edb985", 630);
  text(ctx, `Room ${model.room}`, 52, 288, 76, "#fff0d9", 720, "Georgia, Times New Roman, serif");
  text(ctx, "REACHED", 59, 317, 15, "#bdaeC8", 250);

  const values = [
    [model.enemies, "ENEMIES DEFEATED"], [model.bosses, "BOSSES DEFEATED"], [model.gold, "GOLD REMAINING"],
  ];
  values.forEach(([value, label], index) => {
    const x = 54 + index * 366;
    rounded(ctx, x, 354, 350, 102, 12);
    ctx.fillStyle = "#21162beb"; ctx.fill();
    ctx.strokeStyle = "#604263"; ctx.lineWidth = 1; ctx.stroke();
    text(ctx, value, x + 20, 403, 39, index === 2 ? "#ffc66e" : "#faf2ff", 306);
    text(ctx, label, x + 20, 432, 13, "#c7b7d2", 306);
  });

  text(ctx, "LOADOUT AT RUN END", 57, 490, 13, "#d7b294", 500);
  text(ctx, `WEAPON  ${model.weapon}     ·     ARMOR  ${model.armor}`, 57, 520, 22, "#f2e8fc", 575);
  text(ctx, model.relic, 661, 520, 25, "#e3c5ff", 480, "Georgia, Times New Roman, serif");
  text(ctx, `${model.unique} unique relics · ${model.drops} total drops`, 662, 546, 15, "#b9a9c7", 480, undefined, 400);
  ctx.strokeStyle = "#4c354f";
  ctx.beginPath(); ctx.moveTo(56, 569); ctx.lineTo(1144, 569); ctx.stroke();
  text(ctx, model.disclosure, 57, 602, 16, "#e6d7ee", 1080);
  text(ctx, "DELVEWORN", 57, 631, 12, "#a18cae", 1080);
  const png = canvas.toDataURL("image/png");
  if (!png.startsWith("data:image/png;base64,")) throw new Error("Image export is unavailable in this browser.");
  return png;
}
