import fs from "fs";
import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";
import Mp3Files from "./mp3-files.mjs";
import Mp3Tags from "./mp3-tags.mjs";
import Logger from "./utils/logger.mjs";

export default class OverdriveDownload {
  constructor() {
    this.odm = new OdmDownload(),
    this.mp3 = new Mp3Download(),
    this.files = new Mp3Files(),
    this.tags = new Mp3Tags()
  }

  async download(title) {
    const result = {
      completed: {
        odm: false,
        mp3: false,
        rename: false,
        tag: false,
        cleanup: false
      },
      book: {
        path: "",
        partCount: 0,
        metadata: "",
        files: []
      }
    };
    const logger = new Logger();
    logger.debug(`OverdriveDownload.download - started`);
    
    // 1. Download the ODM for the specified title from the library website
    const odmFilePath = await this.odm.download(title);
    result.completed.odm = true;

    // 2. Use the ODM to download the title mp3 files
    const downloadResults = await this.mp3.download(odmFilePath);
    result.book.path = downloadResults.bookPath;
    result.book.partCount = downloadResults.partCount;
    result.book.metadata = downloadResults.bookMetadata;
    result.completed.mp3 = true;

    // 3. Use the download results to rename the files consistently
    const renameResults = await this.files.rename(downloadResults.bookMetadata);
    result.book.files.push(renameResults.files)
    result.completed.rename = true;

    // 4. Use the rename results to normalize the ID3 tags
    const tagResults = await this.tags.normalizeTags(renameResults.directory, downloadResults.bookMetadata);
    result.completed.tag = true;

    // 5. Cleanup the temporary odm files
    fs.rmSync(downloadResults.odmPath);
    fs.rmSync(downloadResults.licensePath);
    result.completed.cleanup = true;
    logger.info(`OverdriveDownload.download - Clenup of temporary odm files complete`);

    
    logger.debug(`OverdriveDownload.download - completed`);
    return await result;
  }
};

export { OdmDownload, Mp3Download, Mp3Files, Mp3Tags };