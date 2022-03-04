import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import Config from "./utils/config.mjs"
const parser = new DOMParser();

const OMC_VERSION = "1.2.0";
const OS_VERSION = "10.11.6";
const USER_AGENT = "OverDrive Media Console";

export default class Mp3Download {

  constructor() {
    this.configManager = new Config();
    this.config = this.configManager.getConfig();
    this._createDefaultConfig();
  }

  async download(odmPath) {
    // Validate odmPath
    if(!fs.existsSync(odmPath)) {
      throw new Error(`The specified .odm cannot be located: ${odmPath}`);
    }
    this.config.basePath = path.dirname(odmPath);

    // Acquire license
    const licensePath = getLicensePath(odmPath);
    const license = await getLicense(odmPath, licensePath, this.config.clientId);
    if (!license) {
      throw new Error(`License could not be acquired for: ${odmPath}`);
    }

    // Extract metadata
    const bookMetadata = this.metadata(odmPath);

    // Create path
    const bookPath = this._createPath(this.config.basePath, bookMetadata)

    // Download cover
    const coverResult = await downloadCover(bookMetadata.coverImageUrl, bookPath);

    // Download mp3 parts
    const downloadResults = await downloadParts(odmPath, license, this.config.clientId, bookPath);

    // Return the path to the book
    return { 
      bookPath, 
      licensePath,
      odmPath,
      partCount: downloadResults.length,
      bookMetadata,
      downloadResults
    };
  }

  metadata(odmPath) {
    // Get the metadata from the CDATA section of the ODM
    const odmString = fs.readFileSync(odmPath).toString();
    const odmXml = parser.parseFromString(odmString);
    const metadataString = xpath.select("/OverDriveMedia/text()", odmXml)[1].data;    
    const metadataXml = parser.parseFromString(metadataString);
    // Query the desired audiobook metadata
    const metadata = {};
    metadata.author = xpath.select("string(/Metadata/Creators/Creator[@role='Author'])", metadataXml);
    metadata.title = xpath.select("string(/Metadata/Title)", metadataXml);
    metadata.subTitle = xpath.select("string(/Metadata/SubTitle)", metadataXml);
    metadata.series = xpath.select("string(/Metadata/Series)", metadataXml);
    metadata.description = xpath.select("string(/Metadata/Description)", metadataXml);
    metadata.coverImageUrl = xpath.select("string(/Metadata/CoverUrl)", metadataXml);
    metadata.partCount = xpath.select("count(/OverDriveMedia/Formats/Format/Parts/Part)", odmXml);  
    return metadata;
  }

  _createDefaultConfig() {
    if (!this.config.clientId) {
      this.config.clientId = uuidv4();
    }

    if (!this.config.basePath) {
      this.config.basePath = "./"
    }
  
    this.configManager.saveConfig(this.config);
  }

  _getBasePathFromFile(path) {
    path.dirname()
  }

  _createPath(basePath, bookMetadata) {
    // Creates a path where the book parts will be saved
    // ${author}/${title}
    if (!fs.existsSync(basePath)) { 
      throw new Error(`A path for the book cannot be created because the base path does not exist: ${basePath}`)
    }
    const newPath = path.join(basePath, bookMetadata.author, bookMetadata.title)
    fs.mkdirSync(newPath, { recursive: true });
    return newPath;
  }
}


async function getLicense(odmPath, licensePath, clientId) {
  // Skip the license acquisition if it already exists
  if (fs.existsSync(licensePath)) {
    const licenseData = readLicenseFromFile(licensePath);
    // If it is an empty file, remove it an redownload the license
    if (licenseData.length === 0) {
      fs.rmSync(licensePath);
    } else {
      return licenseData;
    }
  }

  // Get info from the odm xml file
  const odmString = fs.readFileSync(odmPath).toString();
  const odmXml = parser.parseFromString(odmString);
  const acquisitionUrl = xpath.select("string(/OverDriveMedia/License/AcquisitionUrl)", odmXml);
  const mediaId = xpath.select1("/OverDriveMedia/@id", odmXml).value;
  // const odmVersion = xpath.select1("/OverDriveMedia/@ODMVersion", odmXml).value;
  // const omcVersion = xpath.select1("/OverDriveMedia/@OMCVersion", odmXml).value;

  // Compute licence hash
  // Base64 enccoded SHA-1 hash
  // Hash this => ClientId|OMC_VERSION|OS_VERSION|ELOSNOC*AIDEM*EVIRDREVO
  //
  // Reference: https://github.com/jvolkening/gloc/blob/v0.601/gloc#L1523-L1531 
  const hashSuffix = "ELOSNOC*AIDEM*EVIRDREVO";
  const rawHash = `${clientId}|${OMC_VERSION}|${OS_VERSION}|${hashSuffix}`
  const hash = crypto.createHash('sha1').update(rawHash, "utf-16le").digest('base64');
  const url = `${acquisitionUrl}?MediaID=${mediaId}&ClientID=${clientId}&OMC=${OMC_VERSION}&OS=${OS_VERSION}&Hash=${hash}`;
  
  // Get the license and save it to a file
  const response = await downloadToFile(licensePath, url, { "User-Agent": USER_AGENT })
  if (response.success) {
    return readLicenseFromFile(licensePath);
  } else {
    throw new Error(`Failed to acquire License for ${odmPath}`)
  }
}

function readLicenseFromFile(licensePath) {
  const license = fs.readFileSync(licensePath).toString();
  return license;
}

function getLicensePath(odmPath) {
  let licensePath = odmPath.replace(".odm", ".license");
  return licensePath;
}

async function downloadParts(odmPath, license, clientId, bookPath) {
  const odmString = fs.readFileSync(odmPath).toString();
  const odmXml = parser.parseFromString(odmString);
  // TODO: This query could be problematic if there are multiple format qualities available
  const downloadBaseUrl = xpath.select("string(/OverDriveMedia/Formats/Format/Protocols/Protocol[@method='download']/@baseurl)", odmXml)
  const parts = xpath.select("/OverDriveMedia/Formats/Format/Parts/Part", odmXml);  
  const partsResult = [];
  for(let part of parts) {
    const partResult = await downloadPart(license, clientId, bookPath, downloadBaseUrl, part);
    partsResult.push(partResult);
  }

  return await partsResult;
}

async function downloadPart(license, clientId, bookPath, downloadBaseUrl, part) {
  const downloadFileName = part.getAttribute("filename");
  const downloadPartName = part.getAttribute("name");
  const downloadPartUrl = `${downloadBaseUrl}/${downloadFileName}`;
  const fileExt = path.extname(downloadFileName);
  const fileName = `${downloadPartName}${fileExt}`;
  const filePath = path.join(bookPath, fileName);
  const headers = {
    "License": license,
    "ClientID": clientId,
    "User-Agent": USER_AGENT
  };
  const downloadResult = await downloadToFile(filePath, downloadPartUrl, headers);
  return downloadResult;
}

async function downloadCover(coverImageUrl, bookPath) {
  const coverFileExt = path.extname(coverImageUrl);
  const coverFileName = "cover";
  const coverImageName = `${coverFileName}${coverFileExt}`;
  const coverImagePath = path.join(bookPath, coverImageName);
  let coverImageData;

  // If it already exists, remove the cover image
  if (fs.existsSync(coverImagePath)) {
    fs.rmSync(coverImagePath);
  }

  // Get the cover image and save it to a file
  const downloadResponse = await downloadToFile(coverImagePath, coverImageUrl, { "User-Agent": USER_AGENT });
  return downloadResponse;
}

async function downloadToFile(filePath, url, headers) {
  // Skip the download process if the file already exists
  if (fs.existsSync(filePath)) {
    return { success: true, filePath, url, downloadSkipped: true }
  }

  try {
    const options = { headers, responseType: "arraybuffer" }
    const response = await axios.get(url, options);
    await fs.promises.writeFile(filePath, response.data);
    return { success: true, filePath, url };
  } catch(error) {
    console.log(`There was an error downloading: "${url}" to "${filePath}"`);
    console.log(error);
    return { success: false, filePath, url };
  }
}

