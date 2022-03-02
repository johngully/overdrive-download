import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";
import Mp3Files from "./mp3-files.mjs";

export default class OverdriveDownload {
  constructor() {
    this.odm = new OdmDownload(),
    this.mp3 = new Mp3Download(),
    this.files = new Mp3Files()
  }
};

export { OdmDownload, Mp3Download, Mp3Files };