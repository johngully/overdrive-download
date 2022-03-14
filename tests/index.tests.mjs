import fs from "fs";
import Logs from "../utils/logger.mjs";
import { default as OverdriveDownload, OdmDownload, Mp3Download } from "../index.mjs";
let logger = new Logs("debug");

const title = "";  // Set this value to test the download of a title that you have on loan

if (title === "") {
  logger.debug("Skipping tests");
  process.exit(0);
}

const overdrive = new OverdriveDownload();
// Download the ODM for the specified title from the library website
const odmFilePath = await overdrive.odm.download(title);
logger.debug("ODM file path:", odmFilePath);

// Use the ODM to download the title mp3 files
const downloadResults = await overdrive.mp3.download(odmFilePath);
logger.debug(`Download of ${downloadResults.partCount} parts complete:`, downloadResults.bookPath)

// Use the download results to rename the files consistently
const renameResults = await overdrive.files.rename(downloadResults.bookMetadata);
logger.debug(`Rename of ${renameResults.files.length} files complete:`, renameResults.directory);

// Use the rename results to normalize the ID3 tags
const tagResults = await overdrive.tags.normalizeTags(renameResults.directory, downloadResults.bookMetadata);
logger.debug(`Tagging of ${tagResults.files.length} files complete`, renameResults.directory);

fs.rmSync(downloadResults.odmPath);
fs.rmSync(downloadResults.licensePath);
