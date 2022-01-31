import "dotenv/config";
import puppeteer from "puppeteer";

export default class OdmDownload {

  constructor() {
    this.browser;
    this.page;
    this.pageConfig = {
      goto: {
        waitUntil: "networkidle2"
      }
    }
    this.config = {}
    this.config.downloadPath = process.env.OVERDRIVE_DOWNLOAD_PATH;
    this.config.libraryName = process.env.OVERDRIVE_LIBRARY_NAME;
    this.config.username = process.env.OVERDRIVE_USERNAME;
    this.config.password = process.env.OVERDRIVE_PASSWORD;
    this.config.urlBase = "overdrive.com";
    this.config.url = `https://${this.config.libraryName}.${this.config.urlBase}`;
  }

  async download(title) {
    // console.log("Download starting");
    let fileName = "";

    // Initialize the browser
    const page = await this._startBrowser();
    
    // Login
    const isLoggedIn = await this._login(this.config.username, this.config.password);
    if (!isLoggedIn) {
      throw new Error("Login failed", this.config)
    }
    // console.log("Login success");

    // Get download button for the title on loan
    const downloadButton = await this._getTitleOnLoan(title)

    // If there is a download, download the file
    if (downloadButton) {
      // console.log("Title available for download:", title);
      fileName = await this._downloadOdm(downloadButton);
      // console.log("Download complete:", fileName);
    }
    
    // Stop the browswer and return the file location
    await this._stopBrowser();
    return fileName;
  }

  async _startBrowser() {
    const headless = true;
    this.browser = await puppeteer.launch({ headless });
    this.page = await this.browser.newPage();

    // If specified, configure the download path
    if (this.config.downloadPath) {
      await this.page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: this.config.downloadPath});
    }
    
    // Emulate a mobile device so that the download button is displayed
    const phone = puppeteer.devices['iPad'];
    await this.page.emulate(phone);
  }
  
  async _stopBrowser() {
    // Currently the download is not completing before the browser is stopped
    // The 5 second delay has been artificially introduced to handle the problem
    // as a temporary fix, until something better can be added.
    await this.page.waitForTimeout(5000);
    await this.browser.close();
  }

  async _login(username, password) {
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
    return isLoggedIn;
  }

  async _getTitleOnLoan(title) {
    // Navigate to the loans page
    const loansUrl = `${this.config.url}/account/loans`;
    await this.page.goto(loansUrl, this.pageConfig.goto);

    // Find the title
    const titleQuery = `h3[title="${title}"]`;
    const titleElement = await this.page.$(titleQuery);
    debugger
    if (!titleElement) {
      return false;
    }

    // Get the download button (relative to the title)
    const parent1 = await titleElement.getProperty('parentNode');
    const parent2 = await parent1.getProperty('parentNode');
    const downloadButton = await parent2.$("a.downloadButton")

    // If it is present, return the download button
    if (downloadButton) {
      return downloadButton;
    } else {
      return false;
    }
  }

  async _downloadOdm(downloadButton) {
    let downloadFileName = "";
    // Start the download
    await downloadButton.click()

    // Click through the Confirm prompt
    await this.page.waitForTimeout(100);
    const confirmButton = await this.page.$("div.reveal-modal a.confirm");
    if (confirmButton) {
      const downloadPromise = this.page.waitForResponse(response => response.url().startsWith(this.config.url));
      await confirmButton.click();

      // Wait until 
      const downloadResponse = await downloadPromise;
      const location = downloadResponse.headers().location;
      const downloadFileName = textBetween(location, ".com/", "?");
      return downloadFileName;
    }
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
