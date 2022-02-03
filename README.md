# OverDrive Download
As Overdrive has deprecated Overdrive Media Console and even hidden the ability to download required `.odm` files for various platforms, it has become more challenging to download library audiobooks for offline use.  This project aims to simplify the process for users who care to download and manage mp3 audiobooks.

The project provides classes that can be used programatically download the `.odm` file as well as the `.mp3` files for books you have on loan from the Overdrive website.

> This project is designed for the legal acquisition of audiobooks for library patrons. Please treat authors and content creators with respect by honoring their copyrights.

# Package usage
The project has two primary functions. The first is to acquire the `.odm` file for a title you have on loan at your library's the Overdrive website. The second is to use this `.odm` file to download the `.mp3` audio files.

Begin by logging into the Overdrive website for your library. Find the book you are interested in, and "Borrow" the title. This should add the book to the "Loans" page under "My Account".

To get the `.odm` file you must provide the **exact title name** of the book you have on loan. 

To get the `.mp3` files you must provide the path to the `.odm` file for the title. Successful execution of `OdmDownload.download()` will return the path to the `.odm` file.

## Example
```js
import OdmDownload from "./odm-download.mjs";
import Mp3Download from "./mp3-download.mjs";

// Download the ODM for the specified title from the library website
const odm = new OdmDownload();
const odmFilePath = await odm.download(title);

// Use the ODM to download the title mp3 files
const mp3 = new Mp3Download();
const downloadResults = await mp3.download(odmFilePath);
```

# Configuration
Configuration can be provided to the library by creating a `.overdrive-downloadsrc` file. The configuration values are stored in a `json` format.

 ### Base Path
 The path where files will be downloaded. This path can be an absolute path or a path relative to the execution path of the library.

### Library Name
The name of the library that is associated with Overdrive.  This is typically the prefix `CNAME` to the `overdrive.com` url. In the case of `https://example.overdrive.com` the library name would be `example`

### Username
The username used to login to the Overdrive library website. This may be your library card number.

### Password
The password used to login to the Overdrive library website. 

> This value should remain on the computer executing the overdrive-download library. Do not commit the `.overdrive-downloadrc` configuration to a source control repository.

## Example configuration file
```js
{
  "basePath":"./downloads",
  "libraryName":"cityname",
  "username":"123456",
  "password":"mysecretpassword"
}
```