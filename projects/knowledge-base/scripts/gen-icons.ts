// Generates minimal valid PNG icon files for the browser extension
const icon = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGBg+A8AAQQBAScAAAAASUVORK5CYII=',
  'base64'
);

await Bun.write('extension/icons/icon16.png', icon);
await Bun.write('extension/icons/icon48.png', icon);
await Bun.write('extension/icons/icon128.png', icon);
console.log('Icons generated.');
