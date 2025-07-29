#!/usr/bin/env -S deno run --allow-all
/// <reference lib="deno.ns" />

import { ensureDir } from "@std/fs";

const coverageDir = "coverage";
const coverageDataDir = `${coverageDir}/data`;

console.log("🧪 Running tests with coverage...\n");

// Ensure coverage directory exists
await ensureDir(coverageDir);

// Clean up previous coverage data
try {
  await Deno.remove(coverageDataDir, { recursive: true });
} catch {
  // Directory might not exist
}

// Run tests with coverage
const testCmd = new Deno.Command("deno", {
  args: [
    "test",
    `--coverage=${coverageDataDir}`,
    "--allow-all",
    "--no-check",
    "--quiet",
    "tests/"
  ],
  stdout: "piped",
  stderr: "piped",
});

const { code, stdout, stderr } = await testCmd.output();

// Display test output
const decoder = new TextDecoder();
console.log(decoder.decode(stdout));

if (code !== 0) {
  console.error("❌ Tests failed");
  console.error(decoder.decode(stderr));
  Deno.exit(code);
}

console.log("\n📊 Generating coverage report...\n");

// Generate text report
const reportCmd = new Deno.Command("deno", {
  args: ["coverage", coverageDataDir],
  stdout: "piped",
});

const { stdout: reportOutput } = await reportCmd.output();
const reportText = decoder.decode(reportOutput);
console.log(reportText);

// Generate LCOV for CI integration
const lcovCmd = new Deno.Command("deno", {
  args: ["coverage", coverageDataDir, "--lcov"],
  stdout: "piped",
});

const { stdout: lcovOutput } = await lcovCmd.output();
await Deno.writeFile(`${coverageDir}/coverage.lcov`, lcovOutput);

// Generate HTML report
const htmlCmd = new Deno.Command("deno", {
  args: ["coverage", coverageDataDir, "--html"],
  stdout: "piped",
});

await htmlCmd.output();

// Parse coverage percentage from report
const coverageMatch = reportText.match(/cover (\d+\.\d+)%/);
const coveragePercent = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

console.log("\n📈 Coverage Summary:");
console.log(`   Overall Coverage: ${coveragePercent.toFixed(2)}%`);

// Check coverage threshold
const threshold = 80;
if (coveragePercent < threshold) {
  console.log(`   ⚠️  Warning: Coverage ${coveragePercent.toFixed(2)}% is below threshold of ${threshold}%`);
} else {
  console.log(`   ✅ Coverage meets threshold of ${threshold}%`);
}

console.log("\n📄 Reports generated:");
console.log(`   - Text report: console output`);
console.log(`   - LCOV report: ${coverageDir}/coverage.lcov`);
console.log(`   - HTML report: ${coverageDir}/html/index.html`);
console.log("\n✨ Done!");