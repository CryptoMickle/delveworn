import type { ReactNode } from "react";
import type { Plan, Preview, Run } from "./types";
import { entity } from "./world";
import styles from "./mind.module.css";

type Action = "preview" | "remember" | "exit" | "correct" | "retry" | "retreat";

/** Advice is derived from the saved world, so returning players get the right next step. */
export function PlayGuide({ run, plan, preview, auto, canRemember, canReuse, atExit, onAction, children }: {
  run: Run; plan: Plan | null; preview: Preview | null; auto: boolean;
  canRemember: boolean; canReuse: boolean; atExit: boolean;
  onAction: (action: Action) => void; children?: ReactNode;
}) {
  const first = run.room.index === 0, captive = entity(run.room, "captive");
  let step = 1, title = "Teach the relic a rule", body = "You are the adventurer in the burgundy cloak, beside the glowing rune. Free the cartographer and reach the stairs. Start with a rule for the relic to follow.", action: Action | null = null, label = "";
  if (run.relic.principles.length) {
    step = 2; title = first ? "Preview a rescue" : "Find a way through the room";
    body = first ? "The lantern makes you easy to see. Put it out, ring the bell to draw the guard away, and open the captive's chain. You will see the whole plan before anything happens." : run.room.objective;
    action = "preview"; label = canReuse ? "Try your maneuver here" : first ? "Show a rescue plan" : "Show a suggested plan";
    if (canReuse && !first) body = "A new room, the same intention. The relic can use your maneuver with different tools. Preview the new plan before you commit.";
    if (run.relic.misunderstanding) {
      title = "The relic misunderstood";
      body = "It protected the guard and left the captive waiting. Tell it the captive must actually go free. Your correction changes what it does next.";
      action = "correct"; label = "Correct the lesson";
    }
    if (run.room.solved) {
      step = 5; title = first ? "First room complete" : "Room complete";
      body = run.room.index < 4 ? "Reach the stairs and choose “Go deeper”. What you taught the relic carries into the next room." : "You can move on now. An open report route lets surviving witnesses tell what they saw. Close it to protect your secret.";
      action = "exit"; label = atExit ? "Continue to the next room" : "Show the way to the stairs";
      if (first && canRemember && !run.relic.maneuvers.length) {
        step = 4; title = "The rescue can become your own ability";
        body = "The cartographer is free. Remember these actions as “Quiet Mercy” so the relic can use the idea with different objects later. This costs no turn.";
        action = "remember"; label = "Remember “Quiet Mercy”";
      }
    }
    if (run.room.goal === "escort" && captive?.freed && !run.room.solved) {
      title = atExit ? "Wait for them at the stairs" : "Escort them to the stairs";
      body = atExit ? "You have arrived. They still need time. Wait one turn and they will move closer. Enemies can act while you wait, too." : "The chain is open, but the rescue is not over. They move towards the exit each time you take a turn. Go together.";
      action = "exit"; label = atExit ? "Preview a turn at the stairs" : "Show the way to the stairs";
    }
    if (run.room.goal === "echo" && captive?.freed && !run.room.solved) {
      title = "The captive is free. Break the Echo";
      body = "The Echo is still standing. Try an attack from hiding. The preview shows your route, its cost, and who can see you.";
      action = "preview"; label = "Preview a hidden attack";
    }
    if (!run.room.solved && ["rescue", "escort"].includes(run.room.goal) && !captive?.active) {
      title = "The rescue was lost";
      body = "They can no longer be saved. Reach the stairs and retreat. What happened will follow you onward.";
      action = "retreat"; label = atExit ? "Retreat" : "Show the way out";
    }
  }
  if (plan) {
    step = run.room.solved ? 5 : 3; title = preview?.legal ? "This is only a preview" : "The plan needs a change";
    body = preview?.legal ? "The dashed line shows where you will go. The numbers mark your actions. Choose “Execute the plan” when ready; you will move and enemies can react." : `${preview?.reason ?? "This route is not possible."} Change the plan or choose another suggestion.`;
    action = null;
  }
  if (run.activePlan) {
    step = run.room.solved ? 5 : 3; title = run.activePlan.interrupted ? "Something got in the way" : auto ? "Your actions are happening in the room" : "The plan is paused";
    body = run.activePlan.interrupted ? `${run.activePlan.interrupted} What already happened stays. Make a new plan from where you are.` : auto ? "Watch your character on the floor. You can pause beside the board. Each step also gives enemies a turn." : "Choose “Continue here” to carry out the rest. Take as long as you like to read and think before continuing.";
    action = run.activePlan.interrupted ? "retry" : null; label = "Make a new plan";
  }
  if (run.status === "fallen") return null;
  return <section className={styles.playGuide} aria-label="Next step" data-testid="play-guide">
    <p className={styles.eyebrow}>{first ? `YOUR FIRST RESCUE · ${step} OF 5` : "NEXT STEP"}</p>
    <h3>{title}</h3><p>{body}</p>
    {run.room.index >= 4 && run.room.index < 6 && !plan && !run.activePlan && !run.room.solved && <p className={styles.guideWitness}>A witness can report what it sees. Amber tiles show its sightlines. Extinguish the light to hide more, or let the witness see what you want the dungeon to believe.</p>}
    {action && <button className={styles.primary} onClick={() => onAction(action!)}>{label} →</button>}
    {children}
    {!run.activePlan && <small>You have time to think. The world advances one turn when you take an action. Examining is free.</small>}
  </section>;
}

export function PlayHelp({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  return <details id="mind-how-to" className={styles.playHelp} open={open} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary>How to play</summary>
    <div>
      <h3>One room. One plan. Who saw it?</h3>
      <ol>
        <li><b>Read the goal above the board.</b>  Your first task is to free the cartographer. You do not need to kill the guard.</li>
        <li><b>Choose a suggested plan.</b>  The dashed line is a possible future. No turns pass until you choose “Execute the plan”.</li>
        <li><b>Watch the actions unfold.</b>  Enemies act, too. Pause beside the board whenever you want to think.</li>
        <li><b>Remember what worked.</b>  A personal maneuver is a sequence of actions the relic can adapt to new rooms.</li>
        <li><b>Reach the stairs and go deeper.</b>  Later, you will also choose which witnesses get to tell your story.</li>
      </ol>
      <div className={styles.helpIdentities}>
        <p><b>The relic learned</b>The rules and reasons you teach it in private. The dungeon cannot hear this conversation.</p>
        <p><b>The dungeon suspects</b>The story that actually arrives from witnesses. It may be incomplete or wrong.</p>
      </div>
      <p><b>An example:</b>  Use Storm several times in front of witnesses. The dungeon may build wards against lightning. Meanwhile, teach the relic a hidden rescue maneuver. Later, that secret plan can exploit what the wards overlook.</p>
      <p><b>Controls:</b>  Select a character or object to see your options. Tap the floor, or use WASD/arrow keys, to move. A distant tile becomes a plan first. Enter examines the selected object when the board has focus.</p>
      <p>You can play using suggestions all the way through. “Describe your own plan” is optional.</p>
    </div>
  </details>;
}
