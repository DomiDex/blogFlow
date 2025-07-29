#!/usr/bin/env deno run --allow-all

import { join } from "https://deno.land/std@0.218.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.218.0/fs/mod.ts";

const BUILD_DIR = "dist";
const SRC_DIR = "src";

interface BuildOptions {
  minify?: boolean;
  check?: boolean;
  bundle?: boolean;
}

function parseArgs(): BuildOptions {
  const args = Deno.args;
  return {
    minify: args.includes("--minify"),
    check: args.includes("--check") || true,
    bundle: args.includes("--bundle"),
  };
}

async function clean(): Promise<void> {
  console.log("🧹 Cleaning build directory...");
  try {
    await Deno.remove(BUILD_DIR, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
  await ensureDir(BUILD_DIR);
}

async function typeCheck(): Promise<void> {
  console.log("\n📝 Type checking...");
  const process = new Deno.Command("deno", {
    args: ["check", `${SRC_DIR}/**/*.ts`],
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { code } = await process.output();
  if (code !== 0) {
    throw new Error("Type checking failed");
  }
}

async function lint(): Promise<void> {
  console.log("\n🔍 Linting...");
  const process = new Deno.Command("deno", {
    args: ["lint", SRC_DIR],
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { code } = await process.output();
  if (code !== 0) {
    throw new Error("Linting failed");
  }
}

async function test(): Promise<void> {
  console.log("\n🧪 Running tests...");
  const process = new Deno.Command("deno", {
    args: ["test", "--allow-all", "--no-check"],
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { code } = await process.output();
  if (code !== 0) {
    throw new Error("Tests failed");
  }
}

async function bundle(entrypoint: string, output: string): Promise<void> {
  console.log(`\n📦 Bundling ${entrypoint}...`);
  
  // Use deno's emit API to bundle
  const result = await Deno.emit(entrypoint, {
    bundle: "module",
    compilerOptions: {
      target: "esnext",
      lib: ["esnext", "dom"],
    },
  });
  
  await Deno.writeTextFile(output, result.files["deno:///bundle.js"]);
  console.log(`✅ Bundle created: ${output}`);
}

async function optimizeForProduction(): Promise<void> {
  console.log("\n⚡ Optimizing for production...");
  
  // Create optimized imports map
  const importsMap = {
    imports: {
      "@hono/hono": "https://esm.sh/@hono/hono@4.4.0?target=deno",
      "zod": "https://esm.sh/zod@3.23.0?target=deno",
    }
  };
  
  await Deno.writeTextFile(
    join(BUILD_DIR, "import_map.json"),
    JSON.stringify(importsMap, null, 2)
  );
  
  // Copy essential files
  const filesToCopy = [
    "deno.json",
    "deno.lock",
  ];
  
  for (const file of filesToCopy) {
    try {
      await Deno.copyFile(file, join(BUILD_DIR, file));
      console.log(`📄 Copied ${file}`);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        console.warn(`⚠️  Could not copy ${file}: ${error.message}`);
      }
    }
  }
}

async function generateMetadata(): Promise<void> {
  console.log("\n📊 Generating build metadata...");
  
  const metadata = {
    version: Deno.env.get("VERSION") || "1.0.0",
    buildTime: new Date().toISOString(),
    commit: Deno.env.get("GIT_COMMIT") || "unknown",
    branch: Deno.env.get("GIT_BRANCH") || "unknown",
    nodeVersion: Deno.version.deno,
  };
  
  await Deno.writeTextFile(
    join(BUILD_DIR, "build-info.json"),
    JSON.stringify(metadata, null, 2)
  );
}

async function createDeploymentPackage(): Promise<void> {
  console.log("\n📦 Creating deployment package...");
  
  // Create deployment configuration
  const deployConfig = {
    name: "webflow-middleware",
    entrypoint: "./src/main.ts",
    permissions: {
      net: ["webflow.com", "api.webflow.com"],
      env: true,
      read: false,
    },
  };
  
  await Deno.writeTextFile(
    join(BUILD_DIR, "deploy.json"),
    JSON.stringify(deployConfig, null, 2)
  );
  
  // Create start script
  const startScript = `#!/bin/sh
deno run \\
  --allow-net=webflow.com,api.webflow.com \\
  --allow-env \\
  --cached-only \\
  src/main.ts
`;
  
  await Deno.writeTextFile(join(BUILD_DIR, "start.sh"), startScript);
  
  // Make start script executable
  if (Deno.build.os !== "windows") {
    await Deno.chmod(join(BUILD_DIR, "start.sh"), 0o755);
  }
}

async function build(options: BuildOptions): Promise<void> {
  console.log("🏗️  Building Webflow Middleware for production...\n");
  
  try {
    // Clean build directory
    await clean();
    
    // Run checks
    if (options.check) {
      await typeCheck();
      await lint();
      await test();
    }
    
    // Bundle if requested
    if (options.bundle) {
      await bundle(
        join(SRC_DIR, "main.ts"),
        join(BUILD_DIR, "bundle.js")
      );
    }
    
    // Optimize for production
    await optimizeForProduction();
    
    // Generate metadata
    await generateMetadata();
    
    // Create deployment package
    await createDeploymentPackage();
    
    console.log("\n✅ Build completed successfully!");
    console.log(`📁 Output directory: ${BUILD_DIR}/`);
    
    // Show build size
    const buildInfo = await Deno.stat(BUILD_DIR);
    console.log(`📊 Build size: ${buildInfo.size} bytes`);
    
  } catch (error) {
    console.error("\n❌ Build failed:", error.message);
    Deno.exit(1);
  }
}

// Main execution
if (import.meta.main) {
  const options = parseArgs();
  await build(options);
}