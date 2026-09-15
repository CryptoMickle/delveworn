import { createDescent, phase, transition } from "../app/descent/model";
import { isDescent } from "../app/descent/storage";
import { informedPolicy } from "../tests/helpers/descent-policy";

const runs=200;
let wins=0,turns=0,hp=0;
const deathsByRoom:Record<number,number>={};
for (let seed=1;seed<=runs;seed++) {
  let run=createDescent(seed,"simulation");
  for (let n=0;n<250 && !["won","lost"].includes(phase(run));n++) {
    const next=transition(run,informedPolicy(run));
    if (next === run || !isDescent(next)) throw Error(`Stalled/invalid seed ${seed}`);
    run=next;
  }
  if (!["won","lost"].includes(phase(run))) throw Error("Did not finish");
  wins+=Number(phase(run) === "won"); turns+=run.turns; hp+=run.game.hp;
  if (phase(run) === "lost") { const room=run.game.roomsCleared+1; deathsByRoom[room]=(deathsByRoom[room]??0)+1; }
}
const result={runs,wins,winPercent:wins/runs*100,meanTurns:turns/runs,meanFinalHp:hp/runs,deathsByRoom};
console.log(JSON.stringify({rules:"first-descent-2",seeds:"1..200",policy:"tests/helpers/descent-policy.ts",note:"Seeded simulation of unchanged Practice rules, not observed human completion rate or session duration.",result},null,2));
