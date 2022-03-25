import puppeteer from "puppeteer";
import path from "path";
import Logger from "./utils/logger.mjs";
import Configuration from "./utils/configuration.mjs";

const logger = new Logger();

export default class OdmDownload {

  constructor() {
    this.browser;
    this.page;
    this.pageConfig = { goto: { waitUntil: "networkidle2" } };
    this.configuration = new Configuration();
    this.config = this.configuration.load();
    logger.level = this.config.loglevel;
  }

  async download(title) {
    logger.debug(`OdmDownload.download - started`, title);
    let filePath = "";

    // Initialize the browser
    const page = await this._startBrowser();
    
    // Login
    const isLoggedIn = await this._login(this.config.username, this.config.password);
    if (!isLoggedIn) {
      throw new Error("Login failed", this.config)
    }
    logger.info(`Login to overdrive successfull`);

    // If a title has been specified, go to the holds page
    // and attempt to automatically borrow the title
    if (title) {
      const borrowed = await this._borrowTitle(title);
      if (borrowed) {
        logger.info(`Book found to be on hold and borrowed successfully: "${title}"`);
      }
    }

    // Get download button for the title on loan
    const downloadButton = await this._getDownloadForTitle(title);

    // If there is a download, download the file
    const fileName = await this._downloadOdm(downloadButton);
    filePath = path.join(this.config.basePath, fileName);
    logger.info(`Download of .odm file successfull: "${filePath}"`);
    
    // Stop the browswer and return the file location
    await this._stopBrowser();
    logger.verbose(`OdmDownload.download - path to .odm file: "${filePath}"`);
    logger.debug(`OdmDownload.download - completed`);
    return filePath;
  }

  async _startBrowser() {
    logger.debug(`OdmDownload._startBrowser - started`);
    let headless = true;
    if (Object.hasOwn(this.config, "headless")) {
      headless = this.config.headless;
    }
    logger.debug(`OdmDownload._startBrowser - headless: "${headless}"`);
    
    this.browser = await puppeteer.launch({ headless });
    this.page = await this.browser.newPage();

    // Configure the browser so that the download button is displayed
    // This can currently be done by emulating a mobile device, 
    // however it can also be done by providing the right user-agent string
    // await this.page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/605.1.15 (KHTML, like Gecko)");
    const phone = puppeteer.devices['iPad'];
    await this.page.emulate(phone);
    
    // If specified, configure the download path
    if (this.config.basePath) {
      await this.page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: this.config.basePath});
    }
    logger.debug(`OdmDownload._startBrowser - completed`);
  }
  
  async _stopBrowser() {
    logger.debug(`OdmDownload._stopBrowser - started`);
    // Currently the download is not completing before the browser is stopped
    // The 5 second delay has been artificially introduced to handle the problem
    // as a temporary fix, until something better can be added.
    await this.page.waitForTimeout(5000);
    await this.browser.close();
    logger.debug(`OdmDownload._stopBrowser - completed`);
  }

  async _login(username, password) {
    logger.debug(`OdmDownload._login - started`);
    // Navigate to the login page
    const loginUrl = `${this.config.url}/account/ozone/sign-in`;
    await this.page.goto(loginUrl, this.pageConfig.goto);

    // Enter username & password
    await this.page.type("#username", username);
    await this.page.type("#password", password);
    await this.page.click(".signin-button")
  
    // If the url is the base url, assume the login succeded
    await this.page.waitForNavigation();
    const isLoggedIn = sameUrl(this.page.url(), this.config.url);
    logger.debug(`OdmDownload._login - completed`);
    return isLoggedIn;
  }

  async _borrowTitle(title) {
    logger.debug(`OdmDownload._borrowTitle - started`);
    try {
      // Navigate to the holds page
      const holdsUrl = `${this.config.url}/account/holds`;
      await this.page.goto(holdsUrl, this.pageConfig.goto);
      logger.debug(`OdmDownload._borrowTitle - Holds page loaded`);
    
      // Find the title
      const titleElement = await this._getTitle(title);    
      logger.debug(`OdmDownload._borrowTitle - Title found`);

      // Get the borrow button
      const parent1 = await titleElement.getProperty('parentNode');
      const parent2 = await parent1.getProperty('parentNode');
      const borrowButton = await parent2.$("button.TitleActionButton");
      logger.debug(`OdmDownload._borrowTitle - Borrow button found`);

      // Borrow the title
      await borrowButton.click();
      logger.debug(`OdmDownload._borrowTitle - Borrow button clicked`);

      // Click through the Confirm prompt
      await this.page.waitForSelector("div.reveal-modal button.borrow-button");
      const borrowPromise = this.page.waitForResponse(response => response.url().startsWith(this.config.url));
      const confirmButton = await this.page.$("div.reveal-modal button.borrow-button");
      logger.debug(`OdmDownload._borrowTitle - Confirm button found`);
      // The confirmButton is located in a modal dialog.  Use this alternate approach for clicking 
      // the button since it avoids built-in logic that attempts to scroll the button into view.
      await confirmButton.evaluate(button => button.click());
      logger.debug(`OdmDownload._borrowTitle - Confirm button clicked`);
      const borrowResponse = await borrowPromise;
      logger.debug(`OdmDownload._borrowTitle - completed`);
      return true;
    } catch (error) {
      logger.debug(`OdmDownload._borrowTitle - skipped`);
      return false;
    }

  }

  async _getDownloadForTitle(title) {
    logger.debug(`OdmDownload._getDownloadForTitle - started`);
    // Navigate to the loans page
    const loansUrl = `${this.config.url}/account/loans`;
    await this.page.goto(loansUrl, this.pageConfig.goto);

    // Find the title
    const titleElement = await this._getTitle(title);

    // Get the download button (relative to the title)
    const parent1 = await titleElement.getProperty('parentNode');
    const parent2 = await parent1.getProperty('parentNode');
    const accordianButton = await parent2.$("a.accordion-title");
    const downloadButton = await parent2.$("a.downloadButton");

    // Expand the accordian so that the download button is clickable
    if (accordianButton) {
      logger.debug(`OdmDownload._getDownloadForTitle - expanding accordian to show download button`);
      await accordianButton.click(); 
    }

    // If it is present, return the download button
    if (!downloadButton) {  
      throw new Error(`The download for: "${title}" could not be found on the Loans page.`)
    }
    logger.debug(`OdmDownload._getDownloadForTitle - completed`);
    return downloadButton;
  }

  async _getTitle(title) {
    logger.debug(`OdmDownload._getTitle - started`);
    // Find the title element, use the title name if specified
    let titleQuery = `h3[title]`
    if (title) {
      titleQuery = `h3[title="${title}" i]`; // The "i" at the end of the selector makes the query case insensitive
    }
    
    // Get the title element and name
    const titleElement = await this.page.$(titleQuery);
    if (!titleElement && !title) {
      throw new Error(`No title could be found.`)
    } else if (!titleElement) {
      throw new Error(`The title: "${title}" could not be found. Please ensure you have borrowed the title and it is spelled correctly.`)
    }
    
    // title = await (await titleElement.getProperty("title")).jsonValue();
    // logger.log("Title:", title);
    logger.debug(`OdmDownload._getTitle - completed`);
    return titleElement;
  }

  async _downloadOdm(downloadButton) {
    logger.debug(`OdmDownload._downloadOdm - started`);
    // Configure the download response handler to catch responses from the library site
    const downloadPromise = this.page.waitForResponse(response => response.url().startsWith(this.config.url));

    // Download the odm
    await downloadButton.click();

    // Get the download filename from the response headers
    const downloadResponse = await downloadPromise;
    const location = downloadResponse.headers().location;
    const downloadFileName = textBetween(location, ".com/", "?");
    if (!downloadFileName) {
      throw new Error(`The filename of the .odm could not be determined after download`);
    }
    logger.debug(`OdmDownload._downloadOdm - completed`, downloadFileName);
    return downloadFileName;
  }
}

function sameUrl(url1, url2) {
  url1 = trimAny(url1, "/").toLowerCase();
  url2 = trimAny(url2, "/").toLowerCase();
  const areTheSame = url1 === url2;
  return areTheSame;
}

function trimAny(str, chars) {
  var start = 0, 
      end = str.length;

  while(start < end && chars.indexOf(str[start]) >= 0)
      ++start;

  while(end > start && chars.indexOf(str[end - 1]) >= 0)
      --end;

  return (start > 0 || end < str.length) ? str.substring(start, end) : str;
}

function textBetween(text, startAfter, stopBefore) {
  const foundText = text.split(startAfter)[1].split(stopBefore)[0]
  return foundText;
}
