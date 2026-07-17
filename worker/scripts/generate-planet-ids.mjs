import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const archivePath = path.join(projectRoot, "assets/archive/planet-diary-data.js");
const outputPath = path.join(scriptDirectory, "../src/planet-ids.js");
const archive = await readFile(archivePath, "utf8");
const ids = [...archive.matchAll(/^\s{6}"id": "([^"]+)",$/gm)].map((match) => match[1]);

if (ids.length !== 943 || new Set(ids).size !== ids.length) {
  throw new Error(`Expected 943 unique planet IDs, found ${ids.length}`);
}

const output = `// Generated from assets/archive/planet-diary-data.js. Run npm run generate:ids after archive updates.\nexport const VALID_PLANET_IDS = new Set(${JSON.stringify(ids, null, 2)});\n`;
await writeFile(outputPath, output, "utf8");
console.log(`Wrote ${ids.length} planet IDs to ${path.relative(projectRoot, outputPath)}`);
