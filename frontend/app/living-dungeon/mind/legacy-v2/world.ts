import { CHAPTER, COMPONENTS, FAMILIES, FAMILY_COPY } from "./catalogue";
import type { BossComponent, ComponentId, Entity, Family, Hypothesis, Point, Role, Room } from "./types";

export const equalPoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const entity = (room: Room, id: string | undefined) => room.entities.find(e => e.id === id);
export const playerEntity = (room: Room) => room.entities.find(e => e.role === "player")!;
export const byRole = (room: Room, role: Role) => room.entities.find(e => e.role === role && e.active);
export function passable(room: Room, point: Point): boolean {
  return Number.isInteger(point.x) && Number.isInteger(point.y) && point.x > 0 && point.y > 0 && point.x < room.width - 1 && point.y < room.height - 1 && !room.walls.some(p => equalPoint(p, point));
}
/** Integer Bresenham ray. Walls occlude; terminal cells remain inspectable. */
export function lineOfSight(room: Room, from: Point, to: Point): boolean {
  let x = from.x, y = from.y;
  const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let err = dx - dy;
  while (x !== to.x || y !== to.y) {
    const twice = err * 2;
    if (twice > -dy) { err -= dy; x += sx; }
    if (twice < dx) { err += dx; y += sy; }
    if (room.walls.some(p => p.x === x && p.y === y)) return false;
  }
  return true;
}
export function canSee(room: Room, observer: Entity, target: Point, hidden = false): boolean {
  if (!observer.active || observer.hp <= 0 || observer.distracted > 0 || observer.freed || observer.id === "player") return false;
  const range = room.light ? observer.sight : Math.min(2, observer.sight);
  return distance(observer, target) <= range && (!hidden || distance(observer, target) <= 1) && lineOfSight(room, observer, target);
}
export function pathTo(room: Room, from: Point, to: Point, adjacent = false): Point[] {
  const queue: { at: Point; path: Point[] }[] = [{ at: from, path: [] }];
  const seen = new Set([`${from.x},${from.y}`]);
  while (queue.length) {
    const item = queue.shift()!;
    if (equalPoint(item.at, to) || (adjacent && distance(item.at, to) <= 1)) return item.path;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const at = { x: item.at.x + dx, y: item.at.y + dy }, key = `${at.x},${at.y}`;
      if (!seen.has(key) && passable(room, at)) { seen.add(key); queue.push({ at, path: [...item.path, at] }); }
    }
  }
  return [];
}
export function composeBoss(hypotheses: Hypothesis[], budget = 6): BossComponent[] {
  const result: BossComponent[] = [];
  for (const theory of [...hypotheses].sort((a, b) => b.confidence - a.confidence || a.claim.localeCompare(b.claim))) {
    if (theory.confidence < 0.48 || theory.rooms.length < 2 || theory.sources.length < 2) continue;
    const entry = (Object.entries(COMPONENTS) as [ComponentId, typeof COMPONENTS[ComponentId]][]).find(([, c]) => c.theory === theory.claim);
    if (!entry || entry[1].cost > budget) continue;
    result.push({ id: entry[0], cost: entry[1].cost, theory: theory.claim, confidence: theory.confidence, sources: [...theory.sources] });
    budget -= entry[1].cost;
  }
  return result;
}
export function chooseFamily(seed: number, index: number, history: Family[], suggested?: Family | null): Family {
  if (index < CHAPTER.length) return CHAPTER[index].family;
  if ((index + 1) % 6 === 0) return "echo";
  const eligible = FAMILIES.filter(f => f !== "echo" && !history.slice(-3).includes(f));
  if (suggested && eligible.includes(suggested)) return suggested;
  return eligible[((seed >>> 0) + index * 31) % eligible.length];
}
function makeEntity(id: string, role: Role, name: string, x: number, y: number, hp = 1): Entity {
  return { id, role, name, x, y, hp, maxHp: hp, active: true, freed: false, sight: role === "observer" ? 7 : 5, distracted: 0, protected: 0, hidden: false, suspicious: false, credibility: role === "observer" ? 0.95 : 0.8, intent: "watch" };
}
export function buildRoom(seed: number, index: number, hypotheses: Hypothesis[], history: Family[], suggested?: Family | null): Room {
  const family = chooseFamily(seed, index, history, suggested), copy = FAMILY_COPY[family], boss = family === "echo";
  const chapter = CHAPTER[index], act = index < 12 ? Math.floor(index / 2) : 6;
  const goal: Room["goal"] = boss ? "echo" : index < 12 ? "rescue" : family === "archive" || family === "garden" ? "evidence" : family === "bridge" || family === "reservoir" ? "escort" : family === "tribunal" ? "story" : "rescue";
  const components = boss ? composeBoss(hypotheses) : [];
  const theory = [...hypotheses].filter(h => h.confidence >= 0.48 && h.rooms.length >= 2).sort((a, b) => b.confidence - a.confidence)[0];
  const adaptive = index >= 6 && theory;
  const geometry: Record<Family, Point[]> = {
    bell: [{ x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }],
    kiln: [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }],
    archive: [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
    bridge: [{ x: 3, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 7, y: 6 }],
    garden: [{ x: 3, y: 3 }, { x: 5, y: 5 }, { x: 7, y: 3 }, { x: 7, y: 6 }],
    tribunal: [{ x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 7, y: 1 }],
    reservoir: [{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 5 }, { x: 5, y: 6 }],
    echo: [{ x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }],
  };
  const walls = geometry[family];
  if (adaptive && theory.claim === "force") walls.push({ x: 6, y: 6 }, { x: 7, y: 6 });
  const entities = [
    makeEntity("player", "player", "Du", 2, 6, 40),
    makeEntity("guardian", boss ? "echo" : "guardian", copy.guardian, 7, 4, boss ? 30 : 12),
    makeEntity("captive", "captive", copy.captive, 8, 2, 8),
    makeEntity("distraction", "distraction", copy.distraction, 3, 4),
    makeEntity("light", "light", copy.light, 4, 2),
    makeEntity("relay", "relay", "Rapportåren", 9, 1),
    makeEntity("exit", "exit", "Trappen under", 9, 7),
    makeEntity("cover", "cover", "Den blinde nisjen", 2, 3),
    makeEntity("evidence", "evidence", "Et ubrukt vitnesegl", 3, 6),
  ];
  if (index >= 4) entities.push(makeEntity("observer", "observer", index > 11 ? "Den omreisende skriveren" : "Skriveren med én hånd", 8, 5));
  if (index >= 12 && Math.floor(index / 6) % 2 === 0) entities.push(makeEntity("observer-2", "observer", "Et annet vitne", 6, 1));
  if (boss) entities.push(makeEntity("resonator", "distraction", "Skyggens resonator", 2, 2));
  // Variations stay inside the directed scene and keep certified routes reachable.
  if (index > 0 && !boss && (seed + index) % 3 === 0) {
    if (!walls.some(w => w.x === 3 && w.y === 2)) entities.find(e => e.id === "light")!.x = 3;
    const observer = entities.find(e => e.id === "observer");
    if (observer) observer.y = 6;
  }
  if (adaptive && theory.claim === "mercy") { entities.find(e => e.id === "captive")!.y = 1; entities.find(e => e.id === "guardian")!.y = 2; }
  const hazards: Point[] = [];
  if (adaptive && theory.claim === "storm") hazards.push({ x: 7, y: 3 }, { x: 8, y: 4 });
  if (components.some(c => c.id === "echo-snare")) hazards.push({ x: 3, y: 4 });
  return { id: `chamber-${index}`, index, act, family, goal, title: chapter?.title ?? copy.place, subtitle: chapter?.subtitle ?? "En gammel lærdom. Et rom som prøver et annet spørsmål.", objective: boss ? "Bryt ekkoet. Bruk det du lot være å vise." : goal === "evidence" ? "Hent det utelatte minnet fra vitneseglet. Velg om personen også får fri." : goal === "escort" ? "Frigjør personen og følg dem helt fram til trappen." : goal === "story" ? "Bestem hvilken historie som når fram: stans rapportåren, eller la vitnet fortelle." : "Få den fangede fri. Bestem hvem som får fortelle hvordan.", width: 11, height: 9, walls, shadows: [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 6, y: 4 }].filter(s => !walls.some(w => equalPoint(s, w))), hazards, entities, turn: 0, solved: false, escaped: false, light: true, alert: 0, reportDelay: index < 4 ? 999 : Math.max(2, 6 - Math.floor(index / 12)), components, adaptation: adaptive ? theory.claim : null, adaptationSources: adaptive ? [...theory.sources] : [], inspected: [], captiveDeadline: index === 8 || index === 9 ? 10 : index > 11 ? 28 : 0, disruptionUntil: 0 };
}
