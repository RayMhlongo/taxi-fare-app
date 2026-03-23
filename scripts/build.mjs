import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wwwDir = path.join(rootDir, "www");

const vendorMappings = [
  ["node_modules/@capacitor/core/dist/capacitor.js", "vendor/capacitor.js"],
  ["node_modules/chart.js/dist/chart.umd.min.js", "vendor/chart.umd.min.js"],
  ["node_modules/xlsx/dist/xlsx.full.min.js", "vendor/xlsx.full.min.js"],
  ["node_modules/jspdf/dist/jspdf.umd.min.js", "vendor/jspdf.umd.min.js"],
  ["node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js", "vendor/jspdf.plugin.autotable.min.js"],
];

const publicFiles = [
  "index.html",
  "styles.css",
  "manifest.json",
  "service-worker.js",
];

const publicDirs = [
  "icons",
  "js",
  "vendor",
];

async function ensureDir(targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

async function copyToRootVendor() {
  for (const [fromRelative, toRelative] of vendorMappings) {
    const from = path.join(rootDir, fromRelative);
    const to = path.join(rootDir, toRelative);
    await ensureDir(to);
    await copyFile(from, to);
  }
}

async function rebuildWww() {
  await rm(wwwDir, { recursive: true, force: true });
  await mkdir(wwwDir, { recursive: true });

  for (const file of publicFiles) {
    await copyFile(path.join(rootDir, file), path.join(wwwDir, file));
  }

  for (const dir of publicDirs) {
    await cp(path.join(rootDir, dir), path.join(wwwDir, dir), { recursive: true });
  }
}

await copyToRootVendor();
await rebuildWww();

console.log("InsightRide web assets built and synced to www.");
