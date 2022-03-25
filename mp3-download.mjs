import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import Logger from "./utils/logger.mjs";
import Configuration from "./utils/configuration.mjs";

const logger = new Logger();
const parser = new DOMParser();

const OMC_VERSION = "1.2.0";
const OS_VERSION = "10.11.6";
const USER_AGENT = "OverDrive Media Console";

export default class Mp3Download {

  constructor() {
    this.configuration = new Configuration();
    this.config = this.configuration.load();
    logger.level = this.config.loglevel;
  }

  async download(odmPath) {
    logger.debug(`Mp3Download.download - started`, odmPath);
    // Validate odmPath
    if(!fs.existsSync(odmPath)) {
      throw new Error(`The specified .odm cannot be located: ${odmPath}`);
    }
    this.config.basePath = path.dirname(odmPath);
    logger.verbose(`Mp3Download.download - basePath: "${this.config.basePath}"`);

    // Acquire license
    const licensePath = getLicensePath(odmPath);
    const license = await getLicense(odmPath, licensePath, this.config.clientId);
    if (!license) {
      throw new Error(`License could not be acquired for: ${odmPath}`);
    }
    logger.info(`License for download acquired successfully`);

    // Extract metadata
    const bookMetadata = this.metadata(odmPath);

    // Create path
    const bookPath = this._createPath(this.config.basePath, bookMetadata);
    logger.info(`Path created for book: "${bookPath}"`);

    // Download cover
    const coverResult = await downloadCover(bookMetadata.coverImageUrl, bookPath);
    logger.info(`Book cover image downloaded successfully: "${coverResult?.filePath}"`);

    // Download mp3 parts
    const downloadResults = await downloadParts(odmPath, license, this.config.clientId, bookPath);
    logger.info(`${downloadResults.length} book parts downloaded successfully`);
    logger.verbose("Mp3Download.download - results", { bookPath, licensePath, odmPath, partCount: downloadResults.length, bookMetadata, downloadResults });
    logger.debug(`Mp3Download.download - completed`);

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
    logger.debug(`Mp3Download.metadata - started`);
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
    logger.info(`Metadata parsed from .odm:`, metadata);
    logger.debug(`Mp3Download.metadata - completed`);
    return metadata;
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
  logger.debug(`Mp3Download.getLicense - started`, odmPath, licensePath, clientId);
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
  const response = await downloadToFile(licensePath, url, { "User-Agent": USER_AGENT });
  if (response.success) {
    logger.verbose(`Mp3Download.getLicense - path to license file: "${licensePath}"`);
    logger.debug(`Mp3Download.getLicense - completed`);
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
  logger.debug(`Mp3Download.downloadParts - started`);
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

  logger.verbose(`Mp3Download.downloadParts - parts`, partsResult);
  logger.debug(`Mp3Download.downloadParts - completed`);
  return await partsResult;
}

async function downloadPart(license, clientId, bookPath, downloadBaseUrl, part) {
  logger.debug(`Mp3Download.downloadPart - started`);
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
  logger.info(`Downloaded: "${filePath}"`);
  logger.debug(`Mp3Download.downloadPart - completed`);
  return downloadResult;
}

async function downloadCover(coverImageUrl, bookPath) {
  logger.debug(`Mp3Download.downloadCover - started`);
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
  logger.verbose(`Mp3Download.downloadCover - path to image cover: "${coverImagePath}"`);
  logger.debug(`Mp3Download.downloadCover - completed`);
  return downloadResponse;
}

async function downloadToFile(filePath, url, headers) {
  logger.debug(`Mp3Download.downloadToFile - started`);
  // Skip the download process if the file already exists
  if (fs.existsSync(filePath)) {
    return { success: true, filePath, url, downloadSkipped: true }
  }

  try {
    const options = { headers, responseType: "arraybuffer" }
    const response = await axios.get(url, options);
    await fs.promises.writeFile(filePath, response.data);
    logger.verbose(`Mp3Download.downloadToFile - path to file:`, filePath);
    logger.debug(`Mp3Download.downloadToFile - completed`);
    return { success: true, filePath, url };
  } catch(error) {
    logger.error(`There was an error downloading: "${url}" to "${filePath}"`);
    logger.error(error);
    return { success: false, filePath, url };
  }
}

