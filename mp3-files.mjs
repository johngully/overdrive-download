import fs from "fs";
import fse from "fs-extra";
import path from "path";
import { isNotJunk } from "junk";
import { globby } from "globby";
import fillTemplate from "es6-dynamic-template";
import Config from "./utils/config.mjs";

export default class Mp3Files {

  directoryPattern = "${author}/${title}";
  filePattern = "${title} - Part ${trackNumber}${fileExtension}";
  filesGlobPattern = "**{.mp3,.aac}";

  constructor() {
    this.configManager = new Config();
    this.config = this.configManager.getConfig();
    this._createDefaultConfig();
  }

  async rename(bookMetadata, options) {
    const renameFilesResult = await this.renameFiles(bookMetadata, options);
    const renameDirectoryResult = await this.renameDirectory(bookMetadata, options);
    return {
      directory: renameDirectoryResult,
      files: renameFilesResult.files,
      bookMetadata: renameFilesResult.bookMetadata
    }
  }

  async renameFiles(bookMetadata, options) {
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

    return renameFilesResult;
  }

  async renameDirectory(bookMetadata, options) {
    const { directoryPattern, directoryPath } = this._getOptionsWithDefaults(options, bookMetadata);
    const directoryMetadata = {
      directoryPath,
      basePath: this.config.basePath
    }
    const renamePathResult = await _renamePath(directoryPattern, directoryMetadata, bookMetadata);
    return renamePathResult;
  }

  _getOptionsWithDefaults(options = {}, bookMetadata) {
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

    return { filePattern, directoryPattern, directoryPath };
  }

  _createDefaultConfig() {
    let configChanged = false;
    if (!this.config.directoryPattern) {
      this.config.directoryPattern = this.directoryPattern;
      configChanged = true;
    }
  
    if (!this.config.filePattern) {
      this.config.filePattern = this.filePattern;
      configChanged = true;
    }
  
    if (configChanged) {
      this.configManager.saveConfig(this.config);
    }
  }
}

function _renameFile(filePattern, fileMetadata, bookMetadata) {
  const fileName = _getFileName(filePattern, fileMetadata, bookMetadata);
  const filePath = path.join(fileMetadata.directoryPath, fileName)
  fs.renameSync(fileMetadata.filePath, filePath);
  return filePath;
}

async function _renamePath(directoryPattern, directoryMetadata, bookMetadata) {
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

  // If empty remove original directory structure
  const titlePath = values.directoryPath;
  const authorPath = path.dirname(titlePath);
  _removeEmptyDirectory(titlePath);
  _removeEmptyDirectory(authorPath);

  return newDirectoryPath;
}

function _removeEmptyDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }
  
  // If the directory is empty remove it (get a list of existing files, excluding system files like .DS_Store)
  const directoryContents = fs.readdirSync(directoryPath).filter(isNotJunk);
  if (directoryContents.length === 0) {
    fs.rmSync(directoryPath, { recursive: true })
  }
}

function _getFileMetadata(filePath) {
  const directoryPath = path.dirname(filePath);
  const fileExtension = path.extname(filePath);
  const fileName = path.basename(filePath, fileExtension);
  const trackNumber = fileName.replace(/.*\D(\d+)\D*/, "$1"); // Gets the last number in the fileName string
  return { directoryPath, fileExtension, fileName, filePath, trackNumber };
}

function _getFileName(filePattern, fileMetadata, bookMetadata) {
  // Create the new file naming structure based upon the filePattern
  const values = { ...bookMetadata, ...fileMetadata };
  values.trackNumber = fileMetadata.trackNumber.padStart(bookMetadata.partCount.toString().length, "0"); // Pad the trackNumber with leading 0's
  const fileName = fillTemplate(filePattern, values);
  return fileName;
}