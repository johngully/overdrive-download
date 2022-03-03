import path from "path";
import { globby } from "globby";
import fillTemplate from "es6-dynamic-template";
import NodeID3 from "node-id3";
import Config from "./utils/config.mjs";
import { title } from "process";

export default class Mp3Tags {

  titlePattern = "${title} - Part ${trackNumber}";
  filesGlobPattern = "**{.mp3,.aac}";
  defaultTags = {
    genre: "Audiobooks",
    comment: {
      language: "eng"
    }
  }

  constructor() {
    this.configManager = new Config();
    this.config = this.configManager.getConfig();
    this._createDefaultConfig();
  }

  async normalizeTags(directoryPath, bookMetadata, options) {
    this.config.titlePattern = options.titlePattern || this.config.titlePattern;
    const pattern = path.join(directoryPath, this.filesGlobPattern);
    const files = await globby(pattern);
    bookMetadata.partCount = files.length;

    const normalizeTagsResults = {
      bookMetadata,
      files: []
    };

    for (let filePath of files) {
      const fileMetadata = _getFileMetadata(filePath);
      const tags = this.mapMetadataToID3Tags(fileMetadata, bookMetadata);
      const success = NodeID3.write(tags, filePath);
      if (success) {
        normalizeTagsResults.files.push(filePath);
      }
    }

    return normalizeTagsResults;
  }

  mapMetadataToID3Tags(fileMetadata, bookMetadata) {
    const partTitle = _getPartTitle(this.config.titlePattern, fileMetadata, bookMetadata);
    const { genre, comment: { language }} = this.defaultTags;
    const tags = {
      artist: bookMetadata.author,
      album: bookMetadata.title,
      subtitle: bookMetadata.subTitle,
      TSOA: bookMetadata.series,
      comment: {
        language,
        text: bookMetadata.description
      },
      genre, 
      title: partTitle,
      trackNumber: fileMetadata.trackNumber
    };
    return tags;
  }

  _createDefaultConfig() {
    let configChanged = false;

    if (!this.config.titlePattern) {
      this.config.titlePattern = this.titlePattern;
      configChanged = true;
    }
    
    if (configChanged) {
      this.configManager.saveConfig(this.config);
    }
  }
}

function _getPartTitle(titlePattern, fileMetadata, bookMetadata) {
  const values = { ...bookMetadata, ...fileMetadata };

  // Pad the trackNumber with leading 0's
  values.trackNumber = fileMetadata.trackNumber.padStart(bookMetadata.partCount.toString().length, "0");

  const title = fillTemplate(titlePattern, values);
  return title;
}

function _getFileMetadata(filePath) {
  const directoryPath = path.dirname(filePath);
  const fileExtension = path.extname(filePath);
  const fileName = path.basename(filePath, fileExtension);
  const trackNumber = fileName.replace(/.*\D(\d+)\D*/, "$1"); // Gets the last number in the fileName string
  return { directoryPath, fileExtension, fileName, filePath, trackNumber };
}