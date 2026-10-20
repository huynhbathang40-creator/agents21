// Fails the build if the client bundle references the Scrape Creators key or app password.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const patterns = [/SCRAPECREATORS_API_KEY/, /APP_PASSWORD/, /x-api-key/i];
const secrets = [process.env.SCRAPECREATORS_API_KEY, process.env.APP_PASSWORD].filter(
  (value) => value && value.trim().length > 0,
);
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const text = readFileSync(path, "utf8");
      if (patterns.some((p) => p.test(text)) || secrets.some((s) => text.includes(s))) hits.push(path);
    }
  }
}

walk("dist");
if (hits.length) {
  console.error("Secret check failed. Client bundle references a secret in:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("Secret check passed.");
