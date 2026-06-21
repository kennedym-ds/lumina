#!/usr/bin/env node
// Launch a PowerShell script with PowerShell 7 (pwsh) when available, falling
// back to Windows PowerShell (powershell.exe). Forwards any extra args and the
// child's exit code so it drops into npm scripts transparently.
import { spawnSync } from "node:child_process";

const [scriptPath, ...forwardedArgs] = process.argv.slice(2);

if (!scriptPath) {
  console.error("usage: node scripts/run-ps.mjs <script.ps1> [args...]");
  process.exit(2);
}

function hostIsAvailable(command) {
  const probe = spawnSync(command, ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" });
  return probe.status === 0;
}

const host = hostIsAvailable("pwsh") ? "pwsh" : "powershell";

const result = spawnSync(
  host,
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...forwardedArgs],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Failed to launch ${host}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
