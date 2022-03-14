import Logs from "../utils/logger.mjs";
import OdmDownload from "../odm-download.mjs";
let logger = new Logs("debug");

const title = "";  // Set this value to test the download of a title that you have on loan

async function test() {
  const odm = new OdmDownload();
  const odmFilePath = await odm.download(title);
  logger.debug(odmFilePath);
}

await test();
