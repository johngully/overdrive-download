#!/usr/bin/env node 
import fs from "fs";
import chalk from "chalk-template";
import logSymbols from "log-symbols";
import logUpdate from "log-update";
import { Command } from "commander";
import getPackageVersion from "@jsbits/get-package-version";
import Logger from "./utils/logger.mjs";
import Configuration from "./utils/configuration.mjs";
import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";
import Mp3Files from "./mp3-files.mjs";
import Mp3Tags from "./mp3-tags.mjs";

const program = new Command();
const configuration = new Configuration();
const config = configuration.load();
const logger = new Logger(config.loglevel);
const _originalLogLevel = config.loglevel;;

// Download
program
  .name("odm")
  .description("CLI to download Overdrive audiobooks")
  .argument("<Title of audiobook>", "Title of audiobook on loan")
  .option("--verbose", "Enable verbose logging (optional)")
  .option("--loglevel <string>", "Specify the logging level: error, warn, info, verbose, debug (optional)")
  .action(download);

// Download ODM only
program
  .command("auto")
  .description("CLI to download Overdrive audiobooks. This mode automatically downloads the first available audiobook")
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

// Configure error output
program.configureOutput({
  outputError: (str, write) => write(chalk`{red ${logSymbols.error} ${str}}`)
});

// Handle log levels for all commands
program.on('option:verbose', function () {
  // The user consumable level of "verbose" is implemented as "info"
  // The "verbose" and "debug" log levels are less usable
  // Use --loglevel to access specific log levels
  const level = "info";
  logger.level = level;
  setConfigLogLevel(level);
});

program.on("option:loglevel", function (value) {
  if (!logger.validateLevel(value)) {
    throw new Error(`The log level: "${value}" is not valid. Valid log levels are: error, warn, info, verbose, debug`);
  }
  logger.level = value;
  setConfigLogLevel(value);
});

async function addHelpText(foo) {
  const version = getPackageVersion();
  const formattedConfig = JSON.stringify(config, null, 2);
  const configFilePath = configuration.currentConfigFile;
  program.addHelpText('afterAll', `

Config Location: "${configFilePath}"
Configuration:
${formattedConfig}

Overdrive Download: v${version}
`);
}

async function cleanup() {
  // Reset the loglevel back to the original value after execution
  setConfigLogLevel(_originalLogLevel);
}

async function download(title) {
  // Add this check since the "auto" command passes the empty arguments as an empty object
  if (title instanceof Object) {
    title = null;
  }

  logger.debug(`odm download - started`, title);
  const odmFilePath = await downloadOdm(title);  
  const downloadResults = await downloadMp3(odmFilePath);
  const renameResults = await rename({ path: downloadResults.bookPath, ...downloadResults.bookMetadata });
  const tagResults = await tag({ path: renameResults.directory, ...downloadResults.bookMetadata });
  
  logger.debug(`odm download - cleanup`);
  fs.rmSync(downloadResults.odmPath);
  fs.rmSync(downloadResults.licensePath);

  logger.debug(`odm download - completed`);
  return downloadResults;
}

async function downloadOdm(title) {
  logger.debug(`odm download-odm - started`, title);
  ensureConfigExists();
  const optionalTitleText = title ? ` (${title})` : ``;
  newStatus(chalk`{blue .odm downloading} {gray ${optionalTitleText}}`, chalk`{blue ◌}`);
  const odm = new OdmDownload();
  const odmFilePath = await odm.download(title);
  updateStatus(chalk`{green .odm download complete} {gray ${optionalTitleText}}`, logSymbols.success);
  logger.debug(`odm download-odm - completed`);
  return odmFilePath;
}

async function downloadMp3(odmFilePath) {
  logger.debug(`odm download-mp3 - started`, odmFilePath);
  ensureConfigExists();
  ensureFileExists(odmFilePath);
  newStatus(chalk`{blue audiobook downloading} {gray (${odmFilePath})}`, chalk`{blue ◌}`);
  const mp3 = new Mp3Download();
  const downloadResults = await mp3.download(odmFilePath);
  updateStatus(chalk`{green audiobook download complete} {gray (${downloadResults.partCount} Parts to "${downloadResults.bookPath}")}`, logSymbols.success);
  logger.debug(`odm download-mp3 - completed`);
  return downloadResults;
}

async function rename(options) {
  logger.debug(`odm rename - started`, options);
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
  logger.debug(`odm rename - completed`);
  return renameResults;
}

async function tag(options) {
  logger.debug(`odm tag - started`, options);
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
  logger.debug(`odm tag - completed`);
}

async function createConfig(options) {
  logger.debug(`odm config - started`);
  setConfigValue("username", options.username);
  setConfigValue("password", options.password);
  setConfigValue("basePath", options.basePath);
  setConfigValue("libraryName", options.libraryName);
  configuration.save();
  ensureConfigExists();
  logger.debug(configuration.get());
  logger.debug(`odm config - completed`);
}

function ensureConfigExists() {
  if (!configuration.exists()) {
    logger.debug(`Ensure Config Exists - Config does not exist`);
    program.showHelpAfterError(chalk`{gray ${logSymbols.info} Try using the following command to create one:\n  {italic odm config -l example-library-name -u example-username -p example-password -dl "./example/dowload/path"}\n}`)
    program.error(chalk`Could not locate a configuration file: {bold ${configuration.currentConfigFile}}`);
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
  // If the log level is high enough, remove log line updating
  // so that each log statement is written to a new line
  if (logger.useLevel(logger.levels.info)) {
    logUpdate.done();
  }
  logUpdate(value)
}

function setConfigValue(key, value) {
  if (value !== null && value !== undefined) {
    configuration.set(key, value);
  }
}

function setConfigLogLevel(level = "warn") {
  configuration.set("loglevel", level);
  configuration.save();
}

async function runProgram () {
  // Run the program, and cleanup
  try {
    addHelpText();
    await program.parseAsync();
  } finally {
    await cleanup();
  }
}

await runProgram();
