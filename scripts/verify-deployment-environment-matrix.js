#!/usr/bin/env node
/**
 * Deployment Environment Matrix Snapshot Test  (Issue #968)
 *
 * Parses docs/deployment-environment-matrix.md, README.md's mirrored Vercel
 * table, and the committed vercel.json, then asserts they all describe the
 * same Vercel project settings — so a change to one can't silently drift
 * from the others.
 *
 * Checks:
 *   - Install/Build/Output commands documented in both docs match the
 *     committed vercel.json exactly.
 *   - The documented Root Directory exists and defines a "build" script;
 *     the repository root does not (the failure mode this table warns
 *     about must stay true).
 *   - The documented Node.js Version matches the frontend CI job's
 *     node-version.
 *   - Every VITE_ variable name referenced in the deployment matrix doc is
 *     a recognized variable (present in client/.env.example or documented
 *     in docs/frontend-env-reference.md).
 *
 * On drift, prints a documented-vs-committed diff for each mismatch and
 * exits non-zero. See "Keeping this document in sync" in
 * docs/deployment-environment-matrix.md for how to fix it.
 *
 * Usage: node scripts/verify-deployment-environment-matrix.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const DOCS_PATH = "docs/deployment-environment-matrix.md";
const README_PATH = "README.md";
const VERCEL_PATH = "vercel.json";
const CI_PATH = ".github/workflows/ci.yml";
const ENV_EXAMPLE_PATH = "client/.env.example";
const ENV_REFERENCE_PATH = "docs/frontend-env-reference.md";

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

/**
 * Parses the first two-column "| Setting | Value |" markdown table found
 * after `heading` (a literal substring search) into a plain object keyed by
 * the left column, stripped of markdown backticks.
 */
function parseSettingsTable(content, heading, sourceLabel) {
  const headingIndex = content.indexOf(heading);
  if (headingIndex === -1) {
    throw new Error(`Could not find "${heading}" in ${sourceLabel}`);
  }

  const lines = content.slice(headingIndex).split("\n");
  const settings = {};
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (inTable) break; // table ended
      continue;
    }
    inTable = true;

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim().replace(/`/g, ""));
    if (cells.length < 2) continue;

    const [key, value] = cells;
    if (key === "Setting" || /^-+$/.test(key)) continue; // header/separator row
    settings[key] = value;
  }

  return settings;
}

function extractViteVarNames(content) {
  return new Set(content.match(/VITE_[A-Z0-9_]+/g) || []);
}

function loadCanonicalViteVarNames() {
  const names = new Set();

  for (const line of readFile(ENV_EXAMPLE_PATH).split("\n")) {
    const match = line.trim().match(/^(VITE_[A-Z0-9_]+)=/);
    if (match) names.add(match[1]);
  }

  for (const name of extractViteVarNames(readFile(ENV_REFERENCE_PATH))) {
    names.add(name);
  }

  return names;
}

/** Grabs `node-version` from the frontend job specifically — other jobs may pin a different version. */
function extractFrontendCiNodeVersion(content) {
  const jobIndex = content.indexOf("\n  frontend:");
  if (jobIndex === -1) return null;
  const jobSlice = content.slice(jobIndex, jobIndex + 3000);
  const match = jobSlice.match(/node-version:\s*"?(\d+)"?/);
  return match ? match[1] : null;
}

const failures = [];

function recordMismatch(label, documented, committed, documentedSource, committedSource) {
  if (documented === committed) return;
  failures.push({ label, documented, committed, documentedSource, committedSource });
}

function printDiff() {
  const count = failures.length;
  console.error(`\n❌ Deployment environment matrix drift detected (${count} issue${count === 1 ? "" : "s"}):\n`);
  for (const f of failures) {
    console.error(`  ${f.label}`);
    console.error(`    - documented (${f.documentedSource}): ${JSON.stringify(f.documented)}`);
    console.error(`    + committed  (${f.committedSource}): ${JSON.stringify(f.committed)}`);
    console.error("");
  }
  console.error(`See "Keeping this document in sync" in ${DOCS_PATH} for how to fix this.\n`);
}

function main() {
  const docs = readFile(DOCS_PATH);
  const readme = readFile(README_PATH);
  const vercelJson = JSON.parse(readFile(VERCEL_PATH));
  const ci = readFile(CI_PATH);

  const docsSettings = parseSettingsTable(docs, "### Vercel Project Settings", DOCS_PATH);
  const readmeSettings = parseSettingsTable(readme, "## Vercel Deployment Settings", README_PATH);

  // --- Install / Build / Output vs vercel.json -----------------------------
  recordMismatch("Install Command", docsSettings["Install Command"], vercelJson.installCommand, DOCS_PATH, VERCEL_PATH);
  recordMismatch("Build Command", docsSettings["Build Command"], vercelJson.buildCommand, DOCS_PATH, VERCEL_PATH);
  recordMismatch("Output Directory", docsSettings["Output Directory"], vercelJson.outputDirectory, DOCS_PATH, VERCEL_PATH);

  recordMismatch("Install Command (README)", readmeSettings["Install Command"], vercelJson.installCommand, README_PATH, VERCEL_PATH);
  recordMismatch("Build Command (README)", readmeSettings["Build Command"], vercelJson.buildCommand, README_PATH, VERCEL_PATH);
  recordMismatch("Output Directory (README)", readmeSettings["Output Directory"], vercelJson.outputDirectory, README_PATH, VERCEL_PATH);

  // Docs and README are both hand-maintained and must agree with each other too.
  recordMismatch("Root Directory (docs vs README)", docsSettings["Root Directory"], readmeSettings["Root Directory"], DOCS_PATH, README_PATH);
  recordMismatch("Node.js Version (docs vs README)", docsSettings["Node.js Version"], readmeSettings["Node.js Version"], DOCS_PATH, README_PATH);

  // --- Root Directory --------------------------------------------------------
  const rootDirectory = docsSettings["Root Directory"];
  if (!rootDirectory) {
    failures.push({
      label: "Root Directory",
      documented: undefined,
      committed: undefined,
      documentedSource: DOCS_PATH,
      committedSource: DOCS_PATH,
    });
  } else if (!fileExists(rootDirectory)) {
    failures.push({
      label: "Root Directory",
      documented: rootDirectory,
      committed: "(directory does not exist)",
      documentedSource: DOCS_PATH,
      committedSource: "repository",
    });
  } else if (!fileExists(path.join(rootDirectory, "package.json"))) {
    failures.push({
      label: "Root Directory",
      documented: rootDirectory,
      committed: "(no package.json)",
      documentedSource: DOCS_PATH,
      committedSource: `${rootDirectory}/package.json`,
    });
  } else {
    const rootPkg = JSON.parse(readFile(path.join(rootDirectory, "package.json")));
    if (!rootPkg.scripts || !rootPkg.scripts.build) {
      failures.push({
        label: `Root Directory (${rootDirectory}/package.json must define a "build" script)`,
        documented: "build script present",
        committed: "no build script",
        documentedSource: DOCS_PATH,
        committedSource: `${rootDirectory}/package.json`,
      });
    }
  }

  // The doc's stated failure mode ("repo root has no build script, so it
  // fails loudly if Root Directory is misconfigured") must stay true.
  const repoRootPkg = JSON.parse(readFile("package.json"));
  if (repoRootPkg.scripts && repoRootPkg.scripts.build) {
    failures.push({
      label: "Root Directory warning is stale",
      documented: 'repository root has no "build" script',
      committed: 'repository root now defines a "build" script',
      documentedSource: DOCS_PATH,
      committedSource: "package.json",
    });
  }

  // --- Node.js Version vs CI ---------------------------------------------------
  const documentedNodeVersion = docsSettings["Node.js Version"];
  const ciNodeVersion = extractFrontendCiNodeVersion(ci);
  if (documentedNodeVersion && ciNodeVersion) {
    const documentedMajorMatch = documentedNodeVersion.match(/\d+/);
    recordMismatch(
      "Node.js Version (docs vs CI frontend job)",
      documentedMajorMatch ? documentedMajorMatch[0] : documentedNodeVersion,
      ciNodeVersion,
      DOCS_PATH,
      CI_PATH,
    );
  }

  // --- Env var names -----------------------------------------------------------
  const canonicalVars = loadCanonicalViteVarNames();
  const docVars = extractViteVarNames(docs);
  for (const name of docVars) {
    if (canonicalVars.has(name)) continue;
    failures.push({
      label: `Env variable "${name}" referenced in deployment matrix`,
      documented: name,
      committed: "(not found in client/.env.example or docs/frontend-env-reference.md)",
      documentedSource: DOCS_PATH,
      committedSource: `${ENV_EXAMPLE_PATH} + ${ENV_REFERENCE_PATH}`,
    });
  }

  if (failures.length > 0) {
    printDiff();
    process.exit(1);
  }

  console.log("✅ Deployment environment matrix matches committed configuration.");
}

main();
