/**
 * Export the approved vector master to native app assets.
 * Supply --sharp-module /path/to/sharp when using an external build-tools install.
 * --native-ios also refreshes an existing local Expo iOS asset catalog.
 */
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_MARK, BrandColor } from '../lib/design/brand.ts';

const require = createRequire(import.meta.url);
const sharpFlag = process.argv.indexOf('--sharp-module');
const sharp = require(sharpFlag >= 0 ? process.argv[sharpFlag + 1] : 'sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = path.join(root, 'assets');
const vectors = path.join(assets, 'branding');
await mkdir(vectors, { recursive: true });

const paths = `<path d="${BRAND_MARK.housePath}" fill="${BrandColor.foreground}"/><path d="${BRAND_MARK.doorPath}" fill="${BrandColor.mint}"/>`;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK.viewBox}" width="256" height="256">${paths}</svg>`;
const canvas = (size, markSize, background) => {
  const offset = (size - markSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}<g transform="translate(${offset} ${offset}) scale(${markSize / BRAND_MARK.width})">${paths}</g></svg>`;
};

const icon = canvas(1024, 800, BrandColor.background);
const adaptive = canvas(1024, 640);
await writeFile(path.join(vectors, 'casa-mark.svg'), mark + '\n');
await writeFile(path.join(vectors, 'casa-icon.svg'), icon + '\n');
await sharp(Buffer.from(icon)).removeAlpha().png().toFile(path.join(assets, 'icon.png'));
await sharp(Buffer.from(canvas(1024, 800))).png().toFile(path.join(assets, 'splash-icon.png'));
await sharp(Buffer.from(adaptive)).png().toFile(path.join(assets, 'android-icon-foreground.png'));
// Keep the static native frame quiet; the matching mark animates in JS.
await sharp({ create: { width: 1242, height: 2688, channels: 3, background: BrandColor.background } })
  .png().toFile(path.join(assets, 'splash-native.png'));

if (process.argv.includes('--native-ios')) {
  const catalog = path.join(root, 'ios/CleanHome/Images.xcassets');
  const appIconDir = path.join(catalog, 'AppIcon.appiconset');
  const iconContents = JSON.parse(await readFile(path.join(appIconDir, 'Contents.json'), 'utf8'));
  for (const entry of iconContents.images) {
    if (!entry.filename) continue;
    const dimension = Number(entry.size.split('x')[0]) * Number.parseFloat(entry.scale || '1');
    await sharp(path.join(assets, 'icon.png')).resize(dimension, dimension).removeAlpha()
      .png().toFile(path.join(appIconDir, entry.filename));
  }
  const splashDir = path.join(catalog, 'SplashScreenLegacy.imageset');
  const splashContents = JSON.parse(await readFile(path.join(splashDir, 'Contents.json'), 'utf8'));
  for (const entry of splashContents.images) {
    if (entry.filename) await copyFile(path.join(assets, 'splash-native.png'), path.join(splashDir, entry.filename));
  }
  const colorFile = path.join(catalog, 'SplashScreenBackground.colorset/Contents.json');
  const colorContents = JSON.parse(await readFile(colorFile, 'utf8'));
  const hex = BrandColor.background.slice(1);
  const channels = [0, 2, 4].map(index => (Number.parseInt(hex.slice(index, index + 2), 16) / 255).toFixed(6));
  for (const entry of colorContents.colors) {
    entry.color = { 'color-space': 'srgb', components: { alpha: '1.000', red: channels[0], green: channels[1], blue: channels[2] } };
  }
  await writeFile(colorFile, JSON.stringify(colorContents, null, 2) + '\n');
}

for (const filename of ['icon.png', 'splash-icon.png', 'android-icon-foreground.png', 'splash-native.png']) {
  const meta = await sharp(path.join(assets, filename)).metadata();
  console.log(`${filename}: ${meta.width}×${meta.height}, alpha=${Boolean(meta.hasAlpha)}`);
}
