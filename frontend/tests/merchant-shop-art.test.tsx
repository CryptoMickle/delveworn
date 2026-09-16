import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MerchantShopArtwork } from "../app/dungeon/merchant-art";

test("Kevin's shop keeps the complete mirrored painting while restoring readable sign art", () => {
  const markup=renderToStaticMarkup(<MerchantShopArtwork />);
  assert.match(markup,/Quartermaster Kevin with his wagon and no-refunds sign/);
  assert.match(markup,/viewBox="0 0 1672 941"/);
  assert.match(markup,/translate\(1672 0\) scale\(-1 1\)/,"the full original scene is mirrored");
  assert.match(markup,/translate\(-409 0\)/,"the original readable sign is moved onto the mirrored wagon");
  assert.equal((markup.match(/merchant-quartermaster-kevin\.webp/g) ?? []).length,2,
    "the mirrored scene and readable sign use only the original painting");
});

test("the unturned shop painting remains available without sign reconstruction", () => {
  const markup=renderToStaticMarkup(<MerchantShopArtwork turned={false} />);
  assert.doesNotMatch(markup,/scale\(-1 1\)/);
  assert.equal((markup.match(/merchant-quartermaster-kevin\.webp/g) ?? []).length,1);
});
