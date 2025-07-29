#!/usr/bin/env -S deno run --allow-run --allow-env

/**
 * Test runner script that provides various test commands
 */

const args = Deno.args;
const testType = args[0] || "all";

// Set test environment
Deno.env.set("NODE_ENV", "test");
Deno.env.set("LOG_LEVEL", "error");

async function runCommand(cmd: string[]) {
  console.log(`Running: ${cmd.join(" ")}`);
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { code } = await command.output();
  return code === 0;
}

switch (testType) {
  case "unit":
    console.log("Running unit tests...");
    await runCommand([
      "deno", "test", 
      "tests/unit",
      "--no-check",
      "--allow-all"
    ]);
    break;
    
  case "integration":
    console.log("Running integration tests...");
    console.log("NOTE: Integration tests require mocking setup");
    await runCommand([
      "deno", "test", 
      "tests/integration",
      "--no-check",
      "--allow-all"
    ]);
    break;
    
  case "all":
    console.log("Running all tests...");
    await runCommand([
      "deno", "test",
      "--no-check",
      "--allow-all"
    ]);
    break;
    
  case "check":
    console.log("Running tests with type checking...");
    await runCommand([
      "deno", "test",
      "--allow-all"
    ]);
    break;
    
  default:
    console.log(`
Usage: deno run --allow-run --allow-env scripts/run-tests.ts [command]

Commands:
  unit        Run unit tests only
  integration Run integration tests only  
  all         Run all tests (default)
  check       Run tests with type checking
    `);
}