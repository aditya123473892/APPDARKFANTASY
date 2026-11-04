const fs = require('node:fs/promises');
const path = require('node:path');

// Authoring helper only: release builds consume the checked-in PNGs. Reuse the
// repository's existing Sharp dependency rather than adding a mobile dependency.
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require('../dfbackend/node_modules/sharp');
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, 'assets/branding');
  const source = await fs.readFile(path.join(directory, 'mark.svg'), 'utf8');
  const monochrome = source.replaceAll('#FFF5F7', '#FFFFFF').replaceAll('#F36F9B', '#FFFFFF');
  const adaptive = (svg) =>
    svg
      .replace(/(<svg[^>]*>)/, '$1<g transform="translate(102.4 102.4) scale(0.8)">')
      .replace('</svg>', '</g></svg>');
  const light = source.replaceAll('#FFF5F7', '#181322');
  const opaque = source.replace(
    /(<svg[^>]*>)/,
    '$1<rect width="1024" height="1024" fill="#181322"/>',
  );
  await Promise.all([
    sharp(Buffer.from(opaque))
      .flatten({ background: '#181322' })
      .removeAlpha()
      .png()
      .toFile(path.join(directory, 'icon.png')),
    sharp(Buffer.from(adaptive(source)))
      .png()
      .toFile(path.join(directory, 'adaptive-foreground.png')),
    sharp(Buffer.from(adaptive(monochrome)))
      .png()
      .toFile(path.join(directory, 'adaptive-monochrome.png')),
    sharp(Buffer.from(source)).png().toFile(path.join(directory, 'splash.png')),
    sharp(Buffer.from(light)).png().toFile(path.join(directory, 'splash-light.png')),
    sharp(Buffer.from(monochrome))
      .trim()
      .resize(96, 96, { fit: 'contain', background: '#00000000' })
      .png()
      .toFile(path.join(directory, 'notification.png')),
    sharp(Buffer.from(opaque))
      .resize(64, 64)
      .flatten({ background: '#181322' })
      .removeAlpha()
      .png()
      .toFile(path.join(directory, 'favicon.png')),
  ]);
  console.log(
    'Generated DARKFANTASY launcher, adaptive, themed, splash, notification and web assets.',
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
