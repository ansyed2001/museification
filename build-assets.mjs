import fs from 'fs'; import { createRequire } from 'module';
const MuseCharacter = createRequire(import.meta.url)('./character.js');
// one per palette so the gallery reads as six different little guys
const cast = MuseCharacter.PALETTES.map((palette, i) => MuseCharacter.traits({
  seed: 1001 + i * 977, palette,
  accessory: ['plain','ears','tufts','antenna','leaf','horn'][i],
  eyes: ['dot','dot','sparkle','happy','dot','sparkle'][i],
}));
cast.forEach((t, i) => fs.writeFileSync(`assets/pfp-${i+1}.svg`, MuseCharacter.svg(t, { radius: 0 })));
// site mark: one tiny guy, no background, for favicon + header
fs.writeFileSync('assets/muse-mark.svg', MuseCharacter.svg(
  MuseCharacter.traits({ seed: 7, palette: MuseCharacter.PALETTES[1], accessory: 'antenna', eyes: 'sparkle', background: false })));
console.log('wrote', cast.length + 1, 'assets');
