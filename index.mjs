import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";

export default class OverdriveDownload {
  constructor() {
    this.odm = new OdmDownload(),
    this.mp3 = new Mp3Download()
  }
};

export { OdmDownload, Mp3Download };