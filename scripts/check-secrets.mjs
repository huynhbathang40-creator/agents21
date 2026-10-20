// Fails the build if the client bundle references the Scrape Creators key.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const patterns = [/SCRAPE_CREATORS_API_KEY/, /x-api-key/i];
const key = process.env.SCRAPE_CREATORS_API_KEY;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const text = readFileSync(path, "utf8");
      if (patterns.some((p) => p.test(text)) || (key && text.includes(key))) hits.push(path);
    }
  }
}

walk("dist");
if (hits.length) {
  console.error("Secret check failed. Client bundle references the API key in:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("Secret check passed.");
