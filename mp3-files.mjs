import fs from "fs";
import path from "path";
import { isNotJunk } from "junk";
import { globby } from "globby";
import fillTemplate from "es6-dynamic-template";
import Config from "./utils/config.mjs";

function _getFileMetadata(filePath) {
  const directoryPath = path.dirname(filePath);
  const fileExtension = path.extname(filePath);
  const fileName = path.basename(filePath, fileExtension);
  const trackNumber = fileName.replace(/.*\D(\d+)\D*/, "$1"); // Gets the last number in the fileName string
  return { directoryPath, fileExtension, fileName, filePath, trackNumber };
}

function _renameFile(filePattern, fileMetadata, bookMetadata) {
  const values = { ...bookMetadata, ...fileMetadata };
  
  // Pad the trackNumber with leading 0's
  values.trackNumber = fileMetadata.trackNumber.padStart(bookMetadata.partCount.toString().length, "0");

  // Create the new file naming structure based upon the filePattern
  const newFileName = fillTemplate(filePattern, values);
  const newFilePath = path.join(fileMetadata.directoryPath, newFileName)
  fs.renameSync(fileMetadata.filePath, newFilePath);
}

function _renamePath(directoryPattern, directoryMetadata, bookMetadata) {
  const values = { ...bookMetadata, ...directoryMetadata };

  // Create the new directory structure based upon the directoryPattern
  const newDirectoryName = fillTemplate(directoryPattern, values);
  const newDirectoryPath = path.join(values.basePath, newDirectoryName)

  // Ensure that the new directory path does not exist
  if (values.directoryPath === newDirectoryPath) {
    return;
  }
  if (fs.existsSync(newDirectoryPath)) {
    throw new Error(`A directory with the name "${newDirectoryPath}" already exists`, newDirectoryPath);
  }

  // Move the files to the new path
  fs.renameSync(values.directoryPath, newDirectoryPath);

  // If empty remove original directory structure
  const titlePath = values.directoryPath;
  const authorPath = path.dirname(titlePath);
  _removeEmptyDirectory(titlePath);
  _removeEmptyDirectory(authorPath);
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

export default class Mp3Files {

  filesGlobPattern = "**{.mp3,.aac}";

  constructor() {
    this.configManager = new Config();
    this.config = this.configManager.getConfig();
    this._createDefaultConfig();
  }

  async rename(bookMetadata, options) {
    await this.renameFiles(bookMetadata, options);
    await this.renameDirectory(bookMetadata, options);
  }

  async renameFiles(bookMetadata, options) {
    let { filePattern, directoryPath } = this._getOptionsWithDefaults(options, bookMetadata);

    // Get all files in the path
    const pattern = path.join(directoryPath, this.filesGlobPattern)
    const files = await globby(pattern);
    bookMetadata.partCount = files.length;

    // Rename each file
    for(let filePath of files) {
      const fileMetadata = _getFileMetadata(filePath);
      _renameFile(filePattern, fileMetadata, bookMetadata);
    }
  }

  async renameDirectory(bookMetadata, options) {
    const { directoryPattern, directoryPath } = this._getOptionsWithDefaults(options, bookMetadata);
    const directoryMetadata = {
      directoryPath,
      basePath: this.config.basePath
    }
    _renamePath(directoryPattern, directoryMetadata, bookMetadata)
  }

  _getOptionsWithDefaults(options = {}, bookMetadata) {
    let { filePattern, directoryPattern, directoryPath } = options;
    // Get the default configured values for options if they are not provided
    directoryPath = directoryPath || path.join(this.config.basePath, bookMetadata.author, bookMetadata.title);
    directoryPattern = directoryPattern || this.config.directoryPattern;
    filePattern = filePattern || this.config.filePattern;

    if (!fs.existsSync(directoryPath)) {
      throw new Error("Could not rename because the specified path does not exist", directoryPath);
    }
    return { filePattern, directoryPattern, directoryPath };
  }

  _createDefaultConfig() {
    let configChanged = false;
    if (!this.config.directoryPattern) {
      this.config.directoryPattern = "${author}/${title}";
      configChanged = true;
    }
  
    if (!this.config.filePattern) {
      this.config.filePattern = "${title} - Part ${trackNumber}${extension}"
      configChanged = true;
    }
  
    if (configChanged) {
      this.configManager.saveConfig(this.config);
    }
  }
}