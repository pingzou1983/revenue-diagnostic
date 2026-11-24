const fs = require("node:fs");
const path = require("node:path");

const read = (name) => fs.readFileSync(path.join(__dirname, name), "utf8").replace(/\r\n/g, "\n");
function replaceOnce(html, marker, replacement) {
  if (html.split(marker).length !== 2) {
    throw new Error(`Expected exactly one packaging marker: ${marker}`);
  }
  return html.replace(marker, () => replacement);
}

const css = read("styles.css");
if (/<\/style/i.test(css)) throw new Error("Stylesheet contains an HTML closing style tag; cannot inline safely.");
const scripts = ["demo-model.js", "app.js"].map((name) =>
  `<script>\n${read(name).replace(/<\/script/gi, "<\\/script")}</script>`
).join("\n");

let html = read("index.html");
html = replaceOnce(html, '<link rel="stylesheet" href="./styles.css">', `<style>\n${css}</style>`);
html = replaceOnce(html, '  <script defer src="./demo-model.js"></script>\n', "");
html = replaceOnce(html, '  <script defer src="./app.js"></script>\n', "");
html = replaceOnce(html, "</body>", `${scripts}\n</body>`);
fs.writeFileSync(path.join(__dirname, "demo.html"), html, "utf8");
console.log(`Generated docs\\mock\\demo.html (${Buffer.byteLength(html, "utf8")} bytes).`);
