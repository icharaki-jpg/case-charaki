import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is not configured; skipping local database migration.");
  process.exit(0);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);
