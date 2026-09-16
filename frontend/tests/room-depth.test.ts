import assert from "node:assert/strict";
import test from "node:test";
import { orderRoomDepthActors } from "../app/dungeon/scene";

test("room actors paint north-to-south with stable ties and identities", () => {
  const enemy={id:"enemy",footY:236,content:{name:"enemy"}};
  const merchant={id:"merchant",footY:270,content:{name:"merchant"}};
  const avatar={id:"avatar",footY:194,content:{name:"avatar"}};
  const loot={id:"loot",footY:270,content:{name:"loot"}};

  const ordered=orderRoomDepthActors([enemy,merchant,avatar,loot]);
  assert.deepEqual(ordered.map(actor => actor.id),["avatar","enemy","merchant","loot"]);
  assert.strictEqual(ordered[2],merchant,"sorting retains the keyed actor record");
  assert.strictEqual(ordered[3],loot,"equal foot positions keep their incoming order");

  const crossed=orderRoomDepthActors([enemy,{...merchant,footY:270},{...avatar,footY:306},loot]);
  assert.deepEqual(crossed.map(actor => actor.id),["enemy","merchant","loot","avatar"]);
});
