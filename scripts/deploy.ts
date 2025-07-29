#!/usr/bin/env deno run --allow-all

const DEPLOY_CONFIG = {
  project: "webflow-middleware",
  entrypoint: "src/main.ts",
  production: {
    envFile: ".env.production",
    deployCommand: "deployctl deploy --prod",
  },
  preview: {
    envFile: ".env.preview",
    deployCommand: "deployctl deploy",
  },
};

interface DeployOptions {
  prod?: boolean;
  preview?: boolean;
  dryRun?: boolean;
}

function parseArgs(): DeployOptions {
  const args = Deno.args;
  return {
    prod: args.includes("--prod"),
    preview: args.includes("--preview"),
    dryRun: args.includes("--dry-run"),
  };
}

async function loadEnvFile(path: string): Promise<void> {
  try {
    const envContent = await Deno.readTextFile(path);
    const lines = envContent.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (key && value) {
          Deno.env.set(key, value);
        }
      }
    }
    
    console.log(`✅ Loaded environment from ${path}`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(`⚠️  No ${path} file found, using system environment`);
    } else {
      throw error;
    }
  }
}

async function runCommand(command: string, args: string[] = []): Promise<number> {
  console.log(`\n🚀 Running: ${command} ${args.join(" ")}`);
  
  const process = new Deno.Command(command, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { code } = await process.output();
  return code;
}

async function checkDeployctl(): Promise<boolean> {
  try {
    const process = new Deno.Command("deployctl", {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { code } = await process.output();
    return code === 0;
  } catch {
    return false;
  }
}

async function installDeployctl(): Promise<void> {
  console.log("📦 Installing deployctl...");
  const code = await runCommand("deno", [
    "install",
    "-Arf",
    "jsr:@deno/deployctl",
  ]);
  
  if (code !== 0) {
    throw new Error("Failed to install deployctl");
  }
}

async function runTests(): Promise<void> {
  console.log("\n🧪 Running tests...");
  const code = await runCommand("deno", ["test", "--allow-all"]);
  
  if (code !== 0) {
    throw new Error("Tests failed. Please fix failing tests before deploying.");
  }
}

async function runChecks(): Promise<void> {
  console.log("\n🔍 Running type checks and linting...");
  
  // Type check
  let code = await runCommand("deno", ["check", "src/**/*.ts"]);
  if (code !== 0) {
    throw new Error("Type checking failed");
  }
  
  // Lint
  code = await runCommand("deno", ["lint"]);
  if (code !== 0) {
    console.log("⚠️  Linting has warnings but continuing...");
  }
  
  // Format check
  code = await runCommand("deno", ["fmt", "--check"]);
  if (code !== 0) {
    console.log("⚠️  Code is not formatted. Run 'deno fmt' to fix.");
  }
}

async function deploy(options: DeployOptions): Promise<void> {
  const isProd = options.prod;
  const mode = isProd ? "production" : "preview";
  
  console.log(`\n🚀 Deploying to ${mode.toUpperCase()}`);
  console.log("=".repeat(50));
  
  // Load appropriate env file
  const envFile = isProd ? DEPLOY_CONFIG.production.envFile : DEPLOY_CONFIG.preview.envFile;
  await loadEnvFile(envFile);
  
  // Check environment
  console.log("\n📋 Checking environment...");
  const checkProcess = new Deno.Command("deno", {
    args: ["run", "--allow-env", "--allow-read", "scripts/check-env.ts"],
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { code: checkCode } = await checkProcess.output();
  if (checkCode !== 0) {
    throw new Error("Environment check failed. Missing required variables.");
  }
  
  // Run checks
  await runChecks();
  
  // Run tests in production deployments
  if (isProd && !options.dryRun) {
    await runTests();
  }
  
  // Check if deployctl is installed
  const hasDeployctl = await checkDeployctl();
  if (!hasDeployctl) {
    await installDeployctl();
  }
  
  if (options.dryRun) {
    console.log("\n🏃 DRY RUN - Skipping actual deployment");
    console.log("Would run:", DEPLOY_CONFIG[isProd ? "production" : "preview"].deployCommand);
    return;
  }
  
  // Deploy
  const deployArgs = [
    "deploy",
    `--project=${DEPLOY_CONFIG.project}`,
    isProd ? "--prod" : "",
    DEPLOY_CONFIG.entrypoint,
  ].filter(Boolean);
  
  const code = await runCommand("deployctl", deployArgs);
  
  if (code !== 0) {
    throw new Error("Deployment failed");
  }
  
  console.log("\n✅ Deployment successful!");
  console.log(`🌐 Your app is now live on Deno Deploy!`);
  
  if (!isProd) {
    console.log("\n💡 This is a preview deployment.");
    console.log("   Run 'deno task deploy:prod' to deploy to production.");
  }
}

// Main execution
if (import.meta.main) {
  try {
    const options = parseArgs();
    
    if (!options.prod && !options.preview) {
      console.log("🚀 Webflow Middleware - Deployment Tool\n");
      console.log("Usage:");
      console.log("  deno task deploy:prod     # Deploy to production");
      console.log("  deno task deploy:preview  # Deploy preview");
      console.log("\nOptions:");
      console.log("  --dry-run  # Show what would be deployed without deploying");
      Deno.exit(0);
    }
    
    await deploy(options);
  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    Deno.exit(1);
  }
}