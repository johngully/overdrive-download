import OdmDownload from "../odm-download.mjs";

const title = "";  // Set this value to test the download of a title that you have on loan

async function test() {
  const odm = new OdmDownload();
  const odmFilePath = await odm.download(title);
  console.log(odmFilePath);
}

await test();
