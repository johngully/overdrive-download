import { default as OverdriveDownload, OdmDownload, Mp3Download } from "../index.mjs";
import fs from "fs";
import { exit } from "process";
const title = "";  // Set this value to test the download of a title that you have on loan

if (title === "") {
  console.log("Skipping tests");
  process.exit(0);
}

const od = new OverdriveDownload();
// Download the ODM for the specified title from the library website
const odmFilePath = await od.odm.download(title);
console.log("ODM file path:", odmFilePath);

// Use the ODM to download the title mp3 files
const downloadResults = await od.mp3.download(odmFilePath);
console.log(`Download of ${downloadResults.partCount} parts complete:`, downloadResults.bookPath)

// Cleanup the ODM and License files once the download has completed
fs.rmSync(downloadResults.odmPath);
fs.rmSync(downloadResults.licensePath);
