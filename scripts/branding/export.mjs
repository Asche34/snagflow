import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Use the workspace compiler so regeneration also works on the project's Node 20 floor.
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../../apps/web/src/lib/brand.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { BRAND, brandSvg } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`
);

const directory = new URL('../../apps/web/public/branding/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, variant] of [
  ['snagflow-mark.svg', 'colour'],
  ['snagflow-mark-inverse.svg', 'inverse'],
  ['snagflow-mark-mono.svg', 'mono'],
  ['snagflow-app-icon.svg', 'app'],
  ['snagflow-logo.svg', 'lockup'],
  ['snagflow-logo-inverse.svg', 'lockup-inverse'],
]) {
  await writeFile(new URL(name, directory), brandSvg(variant));
}
await writeFile(new URL('../../apps/web/src/app/icon.svg', import.meta.url), brandSvg('app'));
const { getSharp } = require('next/dist/server/image-optimizer/transform');
const sharp = getSharp(2, false);
const icon = Buffer.from(brandSvg('app'));
const png = await sharp(icon).resize(32, 32).png().toBuffer();
// ICO directory followed by a PNG image, supported by modern browsers and Windows.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(
  new URL('../../apps/web/src/app/favicon.ico', import.meta.url),
  Buffer.concat([header, png]),
);
await writeFile(
  new URL('../../apps/web/src/app/apple-icon.png', import.meta.url),
  await sharp(icon).resize(180, 180).png().toBuffer(),
);
console.log('Exported six SVG assets, web SVG/ICO icons and Apple touch icon.');

if (process.argv.includes('--mobile')) {
  const mobile = new URL('../../apps/mobile/assets/images/', import.meta.url);
  // Native platforms apply their own icon masks: the base icon must be fully opaque and square.
  const nativeIcon = brandSvg('app').replace('rx="56"', 'rx="0"');
  await writeFile(
    new URL('snagflow-icon.png', mobile),
    await sharp(Buffer.from(nativeIcon)).resize(1024, 1024).png().toBuffer(),
  );
  // The entire mark fits inside Android's central 66dp safe circle on a 108dp layer.
  const layer = (mono = false) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(30 33) scale(.1875)"><path fill="${BRAND.white}" d="${BRAND.body}"/><path fill="${mono ? BRAND.white : BRAND.orange}" d="${BRAND.check}"/></g></svg>`;
  for (const [name, mono] of [
    ['snagflow-adaptive-foreground.png', false],
    ['snagflow-adaptive-monochrome.png', true],
  ]) {
    await writeFile(
      new URL(name, mobile),
      await sharp(Buffer.from(layer(mono)))
        .resize(1024, 1024)
        .png()
        .toBuffer(),
    );
  }
  const splash = brandSvg('app').replace(/<rect[^>]*\/>/, '');
  await writeFile(
    new URL('snagflow-splash.png', mobile),
    await sharp(Buffer.from(splash)).resize(1024, 1024).png().toBuffer(),
  );
  await writeFile(
    new URL('snagflow-favicon.png', mobile),
    await sharp(Buffer.from(nativeIcon)).resize(64, 64).png().toBuffer(),
  );
  console.log(
    'Exported native icon, adaptive foreground/monochrome layers, splash and mobile web favicon.',
  );
}
