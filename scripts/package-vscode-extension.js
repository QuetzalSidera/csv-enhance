#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const extensionDir = path.resolve(rootDir, "editors/vscode-sheet");
const extensionPackagePath = path.join(extensionDir, "package.json");

function main() {
  const packageJson = JSON.parse(fs.readFileSync(extensionPackagePath, "utf8"));
  const extensionId = `${packageJson.publisher}.${packageJson.name}`;
  const outputFileName = `${packageJson.name}-${packageJson.version}.vsix`;
  const outputPath = path.join(extensionDir, outputFileName);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sheet-vsix-"));
  const stagingDir = path.join(tempDir, "staging");
  const extensionStagingDir = path.join(stagingDir, "extension");

  fs.mkdirSync(extensionStagingDir, { recursive: true });

  copyFile(path.join(extensionDir, "package.json"), path.join(extensionStagingDir, "package.json"));
  copyFile(path.join(extensionDir, "README.md"), path.join(extensionStagingDir, "README.md"));
  copyFile(path.join(extensionDir, "extension.js"), path.join(extensionStagingDir, "extension.js"));
  copyFile(
    path.join(extensionDir, "language-configuration.json"),
    path.join(extensionStagingDir, "language-configuration.json"),
  );
  fs.mkdirSync(path.join(extensionStagingDir, "syntaxes"), { recursive: true });
  copyFile(
    path.join(extensionDir, "syntaxes", "sheet.tmLanguage.json"),
    path.join(extensionStagingDir, "syntaxes", "sheet.tmLanguage.json"),
  );
  copyDirectory(path.join(rootDir, "dist", "analysis"), path.join(extensionStagingDir, "dist", "analysis"));
  copyDirectory(path.join(rootDir, "dist", "diagnostics"), path.join(extensionStagingDir, "dist", "diagnostics"));
  copyDirectory(path.join(rootDir, "dist", "expression"), path.join(extensionStagingDir, "dist", "expression"));
  copyDirectory(path.join(rootDir, "dist", "file-interface"), path.join(extensionStagingDir, "dist", "file-interface"));
  copyDirectory(path.join(rootDir, "dist", "lint"), path.join(extensionStagingDir, "dist", "lint"));
  copyDirectory(path.join(rootDir, "dist", "shared"), path.join(extensionStagingDir, "dist", "shared"));

  fs.writeFileSync(path.join(stagingDir, "[Content_Types].xml"), createContentTypesXml(), "utf8");
  fs.writeFileSync(
    path.join(stagingDir, "extension.vsixmanifest"),
    createVsixManifest(packageJson, extensionId),
    "utf8",
  );

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  childProcess.execFileSync(
    "zip",
    ["-qr", outputPath, "[Content_Types].xml", "extension.vsixmanifest", "extension"],
    { cwd: stagingDir },
  );

  process.stdout.write(`${outputPath}\n`);
}

function copyFile(sourcePath, targetPath) {
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      return;
    }
    copyFile(sourcePath, targetPath);
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createContentTypesXml() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="json" ContentType="application/json" />',
    '  <Default Extension="md" ContentType="text/markdown" />',
    '  <Default Extension="xml" ContentType="application/xml" />',
    '  <Default Extension="vsixmanifest" ContentType="text/xml" />',
    "</Types>",
    "",
  ].join("\n");
}

function createVsixManifest(packageJson, extensionId) {
  const vscodeVersion = packageJson.engines && packageJson.engines.vscode ? packageJson.engines.vscode.replace(/^\^/, "") : "1.85.0";

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">',
    "  <Metadata>",
    `    <Identity Id="${escapeXml(extensionId)}" Version="${escapeXml(packageJson.version)}" Language="en-US" Publisher="${escapeXml(packageJson.publisher)}" />`,
    `    <DisplayName>${escapeXml(packageJson.displayName)}</DisplayName>`,
    `    <Description xml:space="preserve">${escapeXml(packageJson.description || packageJson.displayName)}</Description>`,
    `    <Tags>${escapeXml((packageJson.keywords || ["sheet"]).join(","))}</Tags>`,
    "  </Metadata>",
    "  <Installation>",
    `    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[${escapeXml(vscodeVersion)},)" />`,
    "  </Installation>",
    "  <Assets>",
    '    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />',
    '    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />',
    '    <Asset Type="Microsoft.VisualStudio.Code.Main" Path="extension/extension.js" Addressable="true" />',
    '    <Asset Type="Microsoft.VisualStudio.Code.Grammar" Path="extension/syntaxes/sheet.tmLanguage.json" Addressable="true" />',
    '    <Asset Type="Microsoft.VisualStudio.Code.LanguageConfiguration" Path="extension/language-configuration.json" Addressable="true" />',
    "  </Assets>",
    "</PackageManifest>",
    "",
  ].join("\n");
}

main();
