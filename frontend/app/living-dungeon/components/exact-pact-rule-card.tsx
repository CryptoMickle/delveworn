import { trackLivingDungeon, type LivingDungeonInputMethod } from "../analytics";
import { explainPact } from "../pact-engine";
import type { LivingDungeon, LivingDungeonCommand } from "../model";

type ExactPactRuleCardProps = Readonly<{
  run: LivingDungeon;
  onCommand: (command: LivingDungeonCommand) => Promise<boolean>;
  onChangeRequest: () => void;
  onShowEveryPact: () => void;
  manualOpen: boolean;
  inputMethod: LivingDungeonInputMethod;
}>;

export function ExactPactRuleCard({
  run,
  onCommand,
  onChangeRequest,
  onShowEveryPact,
  manualOpen,
  inputMethod,
}: ExactPactRuleCardProps) {
  const offer = run.pendingOffer;
  if (!offer) return null;
  const card = explainPact(offer);

  return <section className="living-exact-rule" aria-labelledby="living-exact-rule-title">
    <div className="living-exact-rule-label"><span aria-hidden="true">✦</span> PACT OFFER · EXACT GAME RULE</div>
    <p className="living-exact-rule-trust">This exact card decides what happens in the game.</p>
    <h3 id="living-exact-rule-title">{card.title}</h3>
    <dl className="living-exact-rule-list">
      <div><dt>You receive</dt><dd>{card.benefit}</dd></div>
      <div><dt>You promise</dt><dd>{card.restriction}</dd></div>
      <div><dt>If you break it</dt><dd>{card.breach}</dd></div>
      <div><dt>Ends</dt><dd>{card.duration}</dd></div>
      <div><dt>Example</dt><dd>{card.example}</dd></div>
    </dl>
    <div className="living-exact-rule-actions living-actions" data-keyboard-actions>
      <button type="button" className="living-primary" data-keyboard-default="true" onClick={() => void (async () => {
        const accepted = await onCommand({ type: "accept-pact", pactId: offer.terms.pactId });
        if (accepted) trackLivingDungeon("rule_accepted", { input_method: inputMethod, boon_id: offer.terms.boonId, restriction_id: offer.terms.restrictionId });
      })()}>ACCEPT PACT</button>
      <button type="button" className="living-secondary" onClick={onChangeRequest}>CHANGE MY REQUEST</button>
      <button type="button" className="living-secondary" aria-expanded={manualOpen} aria-controls="living-pact-manual" onClick={onShowEveryPact}>SEE EVERY POSSIBLE PACT</button>
    </div>
  </section>;
}
