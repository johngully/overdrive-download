#!/usr/bin/env node 
import fs from "fs";
import chalk from "chalk-template";
import logSymbols from "log-symbols";
import logUpdate from "log-update";
import { Command } from "commander";
import Config from "./utils/config.mjs";
import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";
import Mp3Files from "./mp3-files.mjs";
import Mp3Tags from "./mp3-tags.mjs";

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

// Rename files
program
.command("rename")
.description("Rename the files and directory structure")
.option("-a --author <string>", "The name of the Author of the book")
.option("-t --title <string>", "The title of the book")
.option("-s --series <string>", "The name of the book series (optional)")
.option("-p --path <string>", "Path to the book '.mp3' files (optional)")
.option("-dp --directoryPattern <string>", "Pattern for directory naming (optional)")
.option("-fp --filePattern <string>", "Pattern for file naming (optional)")
.action(rename);

// Tag files
program
.command("tag")
.description("Set ID3 tags on the '.mp3' files")
.option("-p --path <string>", "Path to the book '.mp3' files")
.option("-a --author <string>", "The name of the Author of the book")
.option("-t --title <string>", "The title of the book")
.option("-s --series <string>", "The name of the book series (optional)")
.option("-d --description <string>", "The short description of the book (optional)")
.option("-pc --partCount <string>", "The total number of parts the books has been broken into (optional)")
.option("-tp --titlePattern <string>", "Pattern for title part naming (optional)")
.action(tag);

// Create config file
program
  .command("config")
  .description("Create/update the configuration file")
  .option("-l --library <string>", "Name of the library")
  .option("-u --username <string>", "Username`")
  .option("-p --password <string>", "Password`")
  .option("-dl --download <string>", "Base path for downloads")
  .action(createConfig);

// Parse the CLI inputs
await program.parseAsync();

async function download(title) {
  const odmFilePath = await downloadOdm(title);  
  const downloadResults = await downloadMp3(odmFilePath);
  const renameResults = await rename({ path: downloadResults.bookPath, ...downloadResults.bookMetadata });
  const tagResults = await tag({ path: renameResults.directory, ...downloadResults.bookMetadata });
  
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

async function rename(options) {
  ensureConfigExists();
  newStatus(chalk`{blue audiobook files renaming} {gray (${options.title})}`, chalk`{blue ◌}`);
  const bookMetadata = {
    author: options.author,
    title: options.title,
    series: options.series
  }
  const renameOptions = {
    directoryPath: options.path,
    directoryPattern: options.directoryPattern,
    filePattern: options.filePattern,
  }

  const mp3Files = new Mp3Files();
  const renameResults = await mp3Files.rename(bookMetadata, renameOptions);
  updateStatus(chalk`{green audiobook files rename complete} {gray (${renameResults.files.length} files in "${renameResults.directory}")}`, logSymbols.success);
  return renameResults;
}

async function tag(options) {
  ensureConfigExists();
  newStatus(chalk`{blue audiobook files tagging} {gray (${options.title})}`, chalk`{blue ◌}`);
  const bookPath = options.path;
  const bookMetadata = {
    author: options.author,
    title: options.title,
    series: options.series,
    description: options.description,
    partCount: options.partCount,
  };
  const tagOptions = {
    titlePattern: options.titlePattern
  };

  const mp3Tags = new Mp3Tags();
  const tagResults = await mp3Tags.normalizeTags(bookPath, bookMetadata, tagOptions);
  updateStatus(chalk`{green audiobook files tagging complete} {gray (${tagResults.files.length} files in "${bookPath}")}`, logSymbols.success);
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
    program.showHelpAfterError(chalk`{gray ${logSymbols.info} Try using the following command to create one:\n  {italic odm config -l example-library-name -u example-username -p example-password -dl "./example/dowload/path"}\n}`)
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