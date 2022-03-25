import path from "path";
import { globby } from "globby";
import fillTemplate from "es6-dynamic-template";
import NodeID3 from "node-id3";
import Logger from "./utils/logger.mjs";
import Configuration from "./utils/configuration.mjs";

const logger = new Logger();

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
    this.configuration = new Configuration();
    this.config = this.configuration.load();
    logger.level = this.config.loglevel;
  }

  async normalizeTags(directoryPath, bookMetadata, options) {
    logger.debug(`Mp3Tags.normalizeTags - started`);
    this.config.titlePattern = options?.titlePattern || this.config.titlePattern;

    // Get all files in the path
    const pattern = path.join(directoryPath, this.filesGlobPattern);
    const files = await globby(pattern);
    bookMetadata.partCount = files.length;

    const normalizeTagsResult = {
      bookMetadata,
      files: []
    };

    // Tag each file
    for (let filePath of files) {
      const fileMetadata = _getFileMetadata(filePath);
      const tags = this.mapMetadataToID3Tags(fileMetadata, bookMetadata);
      const clearResponse = NodeID3.removeTags(filePath);
      const writeResponse = NodeID3.write(tags, filePath);
      if (writeResponse instanceof Error) {
        throw writeResponse;
      }
      logger.info(`Tags updated for: "${filePath}"`);
      normalizeTagsResult.files.push(filePath);
    }

    logger.info(`${files.length} files tagged`);
    logger.verbose(`Mp3Tags.normalizeTags - normalizeTags:`, normalizeTagsResult);
    logger.debug(`Mp3Tags.normalizeTags - completed`);
    return normalizeTagsResult;
  }

  mapMetadataToID3Tags(fileMetadata, bookMetadata) {
    logger.debug(`Mp3Tags.mapMetadataToID3Tags - started`);
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
    logger.verbose(`Mp3Tags.mapMetadataToID3Tags - tags:`, tags);
    logger.debug(`Mp3Tags.mapMetadataToID3Tags - started`);
    return tags;
  }
}

function _getFileMetadata(filePath) {
  logger.debug(`Mp3Tags._getFileMetadata - started`);
  const directoryPath = path.dirname(filePath);
  const fileExtension = path.extname(filePath);
  const fileName = path.basename(filePath, fileExtension);
  const trackNumber = fileName.replace(/.*\D(\d+)\D*/, "$1"); // Gets the last number in the fileName string
  logger.verbose(`Mp3Tags._getFileMetadata - metadata:`, { directoryPath, fileExtension, fileName, filePath, trackNumber });
  logger.debug(`Mp3Tags._getFileMetadata - completed`);
  return { directoryPath, fileExtension, fileName, filePath, trackNumber };
}

function _getPartTitle(titlePattern, fileMetadata, bookMetadata) {
  logger.debug(`Mp3Tags._getPartTitle - started`);
  // Create the part title based upon the titlePattern
  const values = { ...bookMetadata, ...fileMetadata };
  values.trackNumber = fileMetadata.trackNumber.padStart(bookMetadata.partCount.toString().length, "0"); // Pad the trackNumber with leading 0's
  const title = fillTemplate(titlePattern, values);
  logger.verbose(`Mp3Tags._getPartTitle - title: "${title}"`);
  logger.debug(`Mp3Tags._getPartTitle - completed`);
  return title;
}