#!/usr/bin/env node 
import fs from "fs";
import chalk from "chalk-template";
import logSymbols from "log-symbols";
import logUpdate from "log-update";
import { Command } from "commander";
import Config from "./utils/config.mjs";
import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";

const program = new Command();
const configManager = new Config();

program.configureOutput({
  outputError: (str, write) => write(chalk`{red ${logSymbols.error} ${str}}`)
});

// Download
program
  .name("odm")
  .description("CLI to download Overdrive audiobooks")
  .argument("<Title of audiobook>", "Title of audiobook on loan")
  .action(download);

// Download ODM only
program
  .command("download-odm")
  .description("Download the Overdrive '.odm' for the specified title")
  .argument("<Title of audiobook>", "Title of audiobook on loan")
  .action(downloadOdm);

// Download mp3 only
program
  .command("download-mp3")
  .description("Download the audiobook '.mp3' files for the specified '.odm'")
  .argument("<Path to .odm>", "Path to `.odm`")
  .action(downloadMp3);

// Create config file
program
  .command("config")
  .description("Create/update the configuration file")
  .option("-l --library <string>", "Name of the library")
  .option("-dl --download <string>", "Base path for downloads")
  .option("-u --username <string>", "Username`")
  .option("-p --password <string>", "Password`")
  .action(createConfig);

// Parse the CLI inputs
await program.parseAsync();

async function download(title) {
  const odmFilePath = await downloadOdm(title);  
  const downloadResults = await downloadMp3(odmFilePath);
  fs.rmSync(downloadResults.odmPath);
  fs.rmSync(downloadResults.licensePath);
  return downloadResults;
}

async function downloadOdm(title) {
  ensureConfigExists();
  newStatus(chalk`{blue .odm downloading} {gray (${title})}`, chalk`{blue ◌}`);
  const odm = new OdmDownload();
  const odmFilePath = await odm.download(title);
  updateStatus(chalk`{green .odm download complete} {gray (${title})}`, logSymbols.success);
  return odmFilePath;
}

async function downloadMp3(odmFilePath) {
  ensureConfigExists();
  ensureFileExists(odmFilePath);
  newStatus(chalk`{blue audiobook downloading} {gray (${odmFilePath})}`, chalk`{blue ◌}`);
  const mp3 = new Mp3Download();
  const downloadResults = await mp3.download(odmFilePath);
  updateStatus(chalk`{green audiobook download complete} {gray (${downloadResults.partCount} Parts to "${downloadResults.bookPath}")}`, logSymbols.success);
  return downloadResults;
}

function createConfig(options) {
  const optionsConfig = {
    username: options.username,
    password: options.password,
    basePath: options.download,
    libraryName: options.library
  }
  const existingConfig = configManager.getConfig();
  const newConfig = Object.assign(existingConfig, optionsConfig);
  configManager.saveConfig(newConfig);
  ensureConfigExists();
}

function ensureConfigExists() {
  if (!configManager.exists()) {
    program.showHelpAfterError(chalk`{gray ${logSymbols.info} Try using the following command to create one:\n  {italic odm config -u example-username -p example-password -dl "./example/dowload/path" -l example-library-name}\n}`)
    program.error(chalk`Could not locate a configuration file: {bold ${configManager.configFilePath}}`);
  }
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    program.error(chalk`Could not locate file: {bold ${filePath}}`);
  }
}

function newStatus(message, icon) {
  const value = icon ? `${icon} ${message}` : message;
  logUpdate.done();
  logUpdate(value)
}

function updateStatus(message, icon) {
  const value = icon ? `${icon} ${message}` : message;
  logUpdate(value)
}