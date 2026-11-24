// Builds desktop/app from the shared Atlas sources in the project root:
// atlas.html (the same page published on claude.ai), data.json, img/ and media/.
// Run it after changing any of those: `npm run page` (npm start does it for you).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const DESKTOP = path.join(__dirname, "..");
const OUT = path.join(DESKTOP, "app");

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
].join("; ");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const page = fs.readFileSync(path.join(ROOT, "atlas.html"), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>:root{color-scheme:dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
<script src="app-shim.js"></script>
</head><body>
${page}
</body></html>
`;
fs.writeFileSync(path.join(OUT, "index.html"), html);
fs.copyFileSync(path.join(DESKTOP, "app-src", "app-shim.js"), path.join(OUT, "app-shim.js"));
fs.copyFileSync(path.join(ROOT, "data.json"), path.join(OUT, "data.json"));
for (const dir of ["img", "media"]) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, dir), { recursive: true });
}
console.log("Built", path.relative(ROOT, OUT));
