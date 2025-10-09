// listeners/index.js
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function loadListeners() {
  const files = fs
    .readdirSync(__dirname)
    .filter((f) => /^[^.].*\.js$/.test(f) && f !== "index.js");

  await Promise.all(
    files.map((file) => import(pathToFileURL(path.join(__dirname, file))))
  );

  logger.info(`Listener: Loaded ${files.length} file(s)`);
}
