#!/usr/bin/env -S deno run --allow-read --allow-write
/// <reference lib="deno.ns" />

/**
 * Fix lockfile version issues
 * Removes the lockfile and recreates it with the current Deno version
 */

console.log("🔧 Fixing lockfile version issue...");

try {
  // Remove existing lockfile
  await Deno.remove("deno.lock");
  console.log("✅ Removed old lockfile");
} catch (error) {
  if (error instanceof Deno.errors.NotFound) {
    console.log("ℹ️  No existing lockfile found");
  } else {
    console.error("❌ Error removing lockfile:", error.message);
  }
}

console.log("\n📦 Recreating lockfile...");
console.log("This may take a moment as dependencies are cached...\n");

// Run deno cache to recreate lockfile
const cacheProcess = new Deno.Command("deno", {
  args: ["cache", "src/main.ts"],
  stdout: "piped",
  stderr: "piped",
});

const { code, stdout, stderr } = await cacheProcess.output();

if (code === 0) {
  console.log("✅ Lockfile recreated successfully!");
  console.log("\n🎉 You can now run 'deno lint' without issues");
} else {
  console.error("❌ Failed to recreate lockfile");
  console.error(new TextDecoder().decode(stderr));
}

// Add helpful message
console.log("\n💡 Tips:");
console.log("- The lockfile is gitignored, so this won't affect version control");
console.log("- Run this script whenever you see lockfile version errors");
console.log("- Consider updating Deno if this happens frequently");