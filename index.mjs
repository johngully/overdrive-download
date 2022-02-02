import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";
import fs from "fs";
const cleanup = true;
const title = "";

// Download the ODM for the specified title from the library website
const odm = new OdmDownload();
const odmFilePath = await odm.download(title);
console.log("ODM file path:", odmFilePath);

// Use the ODM to download the title mp3 files
const mp3 = new Mp3Download();
const downloadResults = await mp3.download(odmFilePath);
console.log(`Download of ${downloadResults.partCount} parts complete:`, downloadResults.bookPath)

// Cleanup the ODM and License files once the download has completed
if (cleanup) {
  fs.rmSync(downloadResults.odmPath);
  fs.rmSync(downloadResults.licensePath);
}
