import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

test("floor loot assets have actual transparent pixels, not a painted backdrop", async () => {
  for (const name of ["potion", "weapon", "armor", "pouch"]) {
    const path = `public/dungeon/loot/${name}.webp`;
    const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4, `${name} needs an alpha channel`);
    const cornerOffsets = [0, info.width - 1, (info.height - 1) * info.width, info.height * info.width - 1];
    for (const offset of cornerOffsets) assert.equal(data[offset * 4 + 3], 0, `${name} corner is not transparent`);
    let transparent = 0, visible = 0;
    for (let i = 3; i < data.length; i += 4) {
      transparent += Number(data[i] === 0);
      visible += Number(data[i] > 240);
    }
    assert.ok(transparent > info.width * info.height * .1, `${name} still has a solid background`);
    assert.ok(visible > info.width * info.height * .1, `${name} item is missing or too faint`);
  }
});
