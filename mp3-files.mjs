import fs from "fs";
import fse from "fs-extra";
import path from "path";
import { isNotJunk } from "junk";
import { globby } from "globby";
import fillTemplate from "es6-dynamic-template";
import Logger from "./utils/logger.mjs";
import Configuration from "./utils/configuration.mjs";

const logger = new Logger();

export default class Mp3Files {

  filesGlobPattern = "**{.mp3,.aac}";

  constructor() {
    this.configuration = new Configuration();
    this.config = this.configuration.load();
    logger.level = this.config.loglevel;
  }

  async rename(bookMetadata, options) {
    logger.debug(`Mp3Files.rename - started`);
    const renameFilesResult = await this.renameFiles(bookMetadata, options);
    const renameDirectoryResult = await this.renameDirectory(bookMetadata, options);
    logger.debug(`Mp3Files.rename - completed`);
    return {
      directory: renameDirectoryResult,
      files: renameFilesResult.files,
      bookMetadata: renameFilesResult.bookMetadata
    }
  }

  async renameFiles(bookMetadata, options) {
    logger.debug(`Mp3Files.renameFiles - started`);
    let { filePattern, directoryPath } = this._getOptionsWithDefaults(options, bookMetadata);

    // Get all files in the path
    const pattern = path.join(directoryPath, this.filesGlobPattern)
    const files = await globby(pattern);
    bookMetadata.partCount = files.length;

    const renameFilesResult = {
      bookMetadata,
      files: []
    };

    // Rename each file
    for(let filePath of files) {
      const fileMetadata = _getFileMetadata(filePath);
      const newFilePath = _renameFile(filePattern, fileMetadata, bookMetadata);
      if (filePath !== newFilePath) {
        renameFilesResult.files.push(newFilePath);
      }
    }

    logger.info(`${renameFilesResult.files.length} files renamed`);
    logger.debug(`Mp3Files.renameFiles - completed`);
    return renameFilesResult;
  }

  async renameDirectory(bookMetadata, options) {
    logger.debug(`Mp3Files.renameDirectory - started`);
    const { directoryPattern, directoryPath } = this._getOptionsWithDefaults(options, bookMetadata);
    const directoryMetadata = {
      directoryPath,
      basePath: this.config.basePath
    }
    const renamePathResult = await _renamePath(directoryPattern, directoryMetadata, bookMetadata);
    logger.info(`Path renamed to: "${renamePathResult}"`);
    logger.debug(`Mp3Files.renameDirectory - completed`);
    return renamePathResult;
  }

  _getOptionsWithDefaults(options = {}, bookMetadata) {
    logger.debug(`Mp3Files._getOptionsWithDefaults - started`);
    let { filePattern, directoryPattern, directoryPath } = options;
    const basePath = path.join(this.config.basePath); // normalize the base path naming
    // Get the default configured values for options if they are not provided
    filePattern = filePattern || this.config.filePattern;
    directoryPattern = directoryPattern || this.config.directoryPattern;
    directoryPath = directoryPath || path.join(basePath, bookMetadata.author, bookMetadata.title);

    // Ensure the path exists
    // If it doesn't add the base path and double-check
    if (!fs.existsSync(directoryPath)) {
      if (directoryPath.startsWith(basePath)) {
        throw new Error("Could not rename because the specified path does not exist", directoryPath);
      }
      
      directoryPath = path.join(basePath, directoryPath);      
      if (!fs.existsSync(directoryPath)) {
        throw new Error("Could not rename because the specified path does not exist", directoryPath);
      }
    }

    logger.verbose(`Mp3Files._getOptionsWithDefaults - options with defaults:`, { filePattern, directoryPattern, directoryPath });
    logger.debug(`Mp3Files._getOptionsWithDefaults - completed`);
    return { filePattern, directoryPattern, directoryPath };
  }
}

function _renameFile(filePattern, fileMetadata, bookMetadata) {
  logger.debug(`Mp3Files._renameFile - started`);
  const fileName = _getFileName(filePattern, fileMetadata, bookMetadata);
  const filePath = path.join(fileMetadata.directoryPath, fileName)
  fs.renameSync(fileMetadata.filePath, filePath);
  logger.info(`Renamed to: "${filePath}"`);
  logger.verbose(`Mp3Files._renameFile - file renamed`);
  logger.verbose(`  from: "${fileMetadata.filePath}"`);
  logger.verbose(`  to:   "${filePath}"`);
  logger.debug(`Mp3Files._renameFile - completed`);
  return filePath;
}

async function _renamePath(directoryPattern, directoryMetadata, bookMetadata) {
  logger.debug(`Mp3Files._renamePath - started`);
  const values = { ...bookMetadata, ...directoryMetadata };
  const oldDirectoryPath = path.join(values.directoryPath); // Normalize the old directory path naming

  // Create the new directory structure based upon the directoryPattern
  const newDirectoryName = fillTemplate(directoryPattern, values);
  const newDirectoryPath = path.join(values.basePath, newDirectoryName)

  // Skip processing if there's nothing to do
  if (oldDirectoryPath === newDirectoryPath) {
    return oldDirectoryPath;
  }
  // Ensure that the new directory path does not exist
  if (fs.existsSync(newDirectoryPath)) {
    throw new Error(`A directory with the name "${newDirectoryPath}" already exists`, newDirectoryPath);
  }

  // Move the files to the new path
  await fse.mkdirs(newDirectoryPath);
  fs.renameSync(oldDirectoryPath, newDirectoryPath);
  logger.verbose(`Mp3Files._renamePath - path renamed`);
  logger.verbose(`  from: "${oldDirectoryPath}"`);
  logger.verbose(`  to:   "${newDirectoryPath}"`);

  // If empty remove original directory structure
  const titlePath = values.directoryPath;
  const authorPath = path.dirname(titlePath);
  _removeEmptyDirectory(titlePath);
  _removeEmptyDirectory(authorPath);

  logger.debug(`Mp3Files._renamePath - completed`);
  return newDirectoryPath;
}

function _removeEmptyDirectory(directoryPath) {
  logger.debug(`Mp3Files._removeEmptyDirectory - started`);
  if (!fs.existsSync(directoryPath)) {
    return;
  }
  
  // If the directory is empty remove it (get a list of existing files, excluding system files like .DS_Store)
  const directoryContents = fs.readdirSync(directoryPath).filter(isNotJunk);
  if (directoryContents.length === 0) {
    fs.rmSync(directoryPath, { recursive: true })
    logger.verbose(`Mp3Files._removeEmptyDirectory - directory removed: "${directoryPath}"`);  
  }
  logger.debug(`Mp3Files._removeEmptyDirectory - completed`);
}

function _getFileMetadata(filePath) {
  logger.debug(`Mp3Files._getFileMetadata - started`);
  const directoryPath = path.dirname(filePath);
  const fileExtension = path.extname(filePath);
  const fileName = path.basename(filePath, fileExtension);
  const trackNumber = fileName.replace(/.*\D(\d+)\D*/, "$1"); // Gets the last number in the fileName string
  logger.verbose(`Mp3Files._getFileMetadata - metadata:`, { directoryPath, fileExtension, fileName, filePath, trackNumber });
  logger.debug(`Mp3Files._getFileMetadata - completed`);
  return { directoryPath, fileExtension, fileName, filePath, trackNumber };
}

function _getFileName(filePattern, fileMetadata, bookMetadata) {
  logger.debug(`Mp3Files._getFileName - started`);
  // Create the new file naming structure based upon the filePattern
  const values = { ...bookMetadata, ...fileMetadata };
  values.trackNumber = fileMetadata.trackNumber.padStart(bookMetadata.partCount.toString().length, "0"); // Pad the trackNumber with leading 0's
  const fileName = fillTemplate(filePattern, values);
  logger.verbose(`Mp3Files._getFileName - fileName: "${fileName}"`);
  logger.debug(`Mp3Files._getFileName - completed`);
  return fileName;
}