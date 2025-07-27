// Dependency check script
export {};

console.log("Checking all dependencies...\n");

const dependencies = [
  { name: "Hono", import: "@hono/hono" },
  { name: "Hono Zod Validator", import: "@hono/zod-validator" },
  { name: "Hono CORS", import: "@hono/cors" },
  { name: "Hono Logger", import: "@hono/logger" },
  { name: "Zod", import: "zod" },
  { name: "Quill Delta to HTML", import: "quill-delta-to-html" },
  { name: "DOMPurify", import: "dompurify" },
  { name: "jsdom", import: "jsdom" },
  { name: "Slugify", import: "slugify" },
  { name: "Reading Time", import: "reading-time" },
  { name: "Deno STD Testing", import: "@std/testing/asserts" },
  { name: "Deno STD Assert", import: "@std/assert" },
  { name: "Deno STD Dotenv", import: "@std/dotenv" },
  { name: "Deno STD Fmt", import: "@std/fmt/colors" },
  { name: "Deno STD HTTP", import: "@std/http" },
];

let allResolved = true;

for (const dep of dependencies) {
  try {
    await import(dep.import);
    console.log(`✅ ${dep.name} resolved`);
  } catch (error) {
    console.error(`❌ ${dep.name} failed:`, error instanceof Error ? error.message : String(error));
    allResolved = false;
  }
}

// Test import aliases
console.log("\nChecking import aliases...");
const aliases = [
  { name: "Root alias (@/)", path: "@/" },
  { name: "Config alias", path: "@config/" },
  { name: "Middleware alias", path: "@middleware/" },
  { name: "Routes alias", path: "@routes/" },
  { name: "Services alias", path: "@services/" },
  { name: "Utils alias", path: "@utils/" },
  { name: "Types alias", path: "@types/" },
];

for (const alias of aliases) {
  try {
    // Try to resolve the path (won't actually import since files are empty)
    const resolved = import.meta.resolve(alias.path);
    console.log(`✅ ${alias.name} configured`);
  } catch (error) {
    console.error(`❌ ${alias.name} failed:`, error instanceof Error ? error.message : String(error));
    allResolved = false;
  }
}

if (allResolved) {
  console.log("\n✅ All dependencies and aliases resolved successfully!");
} else {
  console.error("\n❌ Some dependencies failed to resolve");
  (globalThis as any).Deno?.exit(1);
}