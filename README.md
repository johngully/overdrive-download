# OverDrive Download
As Overdrive has deprecated Overdrive Media Console and even hidden the ability to download required `.odm` files for various platforms, it has become more challenging to download library audiobooks for offline use. This project aims to simplify the process for users who care to download and manage mp3 audiobooks.

The project provides a CLI, as well as code libraries, that can be used to download audiobooks from the Overdrive website for your library. There are simple commands to automate the entire process, as well as access to each capability for individual use.  The project currently supports:

* Downloading the the `.odm` file and acquiring the appropriate licenses
* Downloading the `.mp3` audiobook files
* Renaming the files and directories in a format of your choosing
* Normalizing ID3 tags for consistency

### Respect the content creators
> This project is designed for the legal acquisition of audiobooks for library patrons. Please treat authors and content creators with respect by honoring their copyrights.

# Quickstart
To get started simply install the command using `npm`, create a configuration file, and download any book that you have borrowed from Overdrive.

### Quickstart Commands
```bash
npm install -g overdrivedownload
odm config -l example-library-name -u example-username -p example-password -dl "./example/dowload/path"
odm "Title of book"
```
### Example 
```bash
npm install -g overdrivedownload
odm config -l nypl -u 123456 -p abcdef -dl "~/Downloads/Audiobooks"
odm "The Old Man and the Sea"
```

# CLI Usage

### CLI installation
```bash
npm install -g overdrivedownload
```
Once the CLI has been installed a configuration file needs to be created. A cli command `odm config` has been created to simplify this process. See the [Configuration section of this document](#configuration) for more details on the range of possible configuration values.

### Example config creation
```bash
odm config -l example-library-name -u example-username -p example-password -dl "./example/dowload/path" }
```

### Example auto download
This example finds the first book available in on the loans page and downloads it. This performs the full download process including: downloading the `.odm`, downloading the `.mp3` files, renaming them consistently, and normalizing the ID3 tags.
```bash
odm auto
```

### Example basic download
This example finds the book by the specified title, and performs the full download process.
```bash
odm "The Old Man and the Sea"
```

### Example `.odm` download only
This example finds the book by the specified title and downloads the `.odm`. This can be useful if you wish to use another application like Overdrive Media Console to download the audiobook `.mp3` files.
```bash
odm download-odm "The Old Man and the Sea"
```

### Example `.mp3` download from existing `.odm`
This example uses the specified `.odm` to download the `.mp3` audiobook files.
```bash
odm download-mp3 "./downloads/TheOldManandtheSea.odm"
```

### Example rename
This example renames the files using the least parameters possible. This command uses the **author** and **title** parameters to calculate the path to the book and relies on the config file for other parameters.
```bash
odm rename --author "Ernest Hemingway" --title "The Old Man and the Sea"
```

*See the [Renaming section of this document](#renaming-files) for more information about configuring directory and file naming patterns.*

### Example rename using all possible parameters
This example renames all the files in the `./downloads/Ernest Hemingway/The Old Man and the Sea` path.  It will result in a new directory `Ernest Hemingway - The Old Man and the Sea` containing files `Part 1.mp3`, `Part 2.mp3`, etc.
```bash
odm rename --author "Ernest Hemingway" --title "The Old Man and the Sea" --path "./downloads/Ernest Hemingway/The Old Man and the Sea" --directoryPattern "${author} - ${title}" --filePattern "Part ${trackNumber}${fileExtension}"
```

# Package usage
The project is currently designed to simplify the workflow of downloading audiobooks from your local Overdrive library. The project currently supports four primary functions.
* Downloading the the `.odm` file and acquiring the appropriate licenses
* Downloading the `.mp3` audiobook files
* Renaming the files and directories in a format of your choosing
* Normalizing ID3 tags for consistency

Begin by logging into the Overdrive website for your library. Find the book you are interested in, and "Borrow" the title. This should add the book to the "Loans" page under "My Account". Once the title is on loan, you may use the library to acquire the `.odm` file and the associated `.mp3` files. Renaming and tagging of files are convienience operations that will work with files regardless of Overdrive.

## Example
```js
import OverdriveDownload from "overdrivedownload";
const overdrive = new OverdriveDownload();

// Modify this to match the book title on the 
// loans page of your library's overdrive website
const title = "The Old Man and the Sea"; 

// Download the ODM for the specified title from the library website
const odmFilePath = await overdrive.odm.download(title);
console.log("ODM file path:", odmFilePath);

// Use the ODM to download the title mp3 files
const downloadResults = await overdrive.mp3.download(odmFilePath);
console.log(`Download of ${downloadResults.partCount} parts complete:`, downloadResults.bookPath)

// Use the download results to rename the files consistently
const renameResults = await overdrive.files.rename(downloadResults.bookMetadata);
console.log(`Rename of ${renameResults.files.length} files complete:`, renameResults.directory);

// Use the rename results to normalize the ID3 tags
const tagResults = await overdrive.tags.normalizeTags(renameResults.directory, downloadResults.bookMetadata);
console.log(`Tagging of ${tagResults.files.length} files complete`, renameResults.directory);

// Cleanup the odm and license files
fs.rmSync(downloadResults.odmPath);
fs.rmSync(downloadResults.licensePath);
```

# Configuration
Configuration of the the library are stored in a `.overdrivedownloadsrc` file. The configuration values are stored in a `json` format and are persisted across uses. A [CLI command](#example-config-creation) `odm config` has been created to simplify the process of creating.

> Running the `odm config` command additional times will update the config file with new values. Each execution of the command is additive, which means that you are not required to specify all the values every time.

### Base Path
The path where files will be downloaded. This path can be an absolute path or a path relative to the execution path of the library.

**Default Value** = `./`

**Optional**

### Library Name
The name of the library that is associated with Overdrive. This is typically the prefix `CNAME` to the `overdrive.com` url. In the case of `https://example.overdrive.com` the library name would be `example`

**Required**

### Username
The username used to login to the Overdrive library website. This may be your library card number.

**Required**

### Password
The password used to login to the Overdrive library website. 

> This value should remain on the computer executing the overdrive-download library. Do not commit the `.overdrivedownloadrc` configuration to a source control repository.

**Required**

### Directory Pattern
The pattern used to name the directories that will contain the audiobook files. This can be a single directory name, or a path.

**Default Value** = `${artist}/${title}`

**Optional**

### File Pattern
The pattern used to name the audiobook files.

**Default Value** = `${title} - Part ${trackNumber}.{fileExtension}`

**Optional**

### Title Pattern
The pattern used to format the `title` tag during ID3 tag normalization.

**Default Value** = `${title} - Part ${trackNumber}`

**Optional**

## Example configuration file
### Minimum required configuration
```json
{
  "basePath": "./downloads",
  "libraryName": "cityname",
  "username": "123456",
  "password": "mysecretpassword"
}
```
### All possible configuration values
```json
{
  "basePath": "./downloads",
  "libraryName": "cityname",
  "username": "123456",
  "password": "mysecretpassword",
  "directoryPattern": "${artist}/${title}",
  "filePattern": "${title} - Part ${trackNumber}.{fileExtension}",
  "titlePattern": "${title} - Part ${trackNumber}"
}
```

# Renaming files
By default the files will be named using the following pattern.  This will create a directory structure with the `Author's name` then another directory with the `Title of the book`.  Each file will be named with the `Title of the book - Part 01` incrementing the number for each track.

### Default naming pattern
```js
`${author}/${title}/${title} - Part ${trackNumber}${fileExtension}`
```
### Resulting files

```
> Earnest Hemingway
  ↳ The Old Man and the Sea
    ↳ The Old Man and the Sea - Part 01.mp3
    ↳ The Old Man and the Sea - Part 02.mp3
    ↳ The Old Man and the Sea - Part 03.mp3
    ...
```

## Altering the naming pattern
To change how directories and files are named, modify the [configuration file](#configuration) adding the optional `directoryPattern` and `filePattern` values.  Use the book metadata keys as tokens in the pattern strings.

Patterns use the [javascript template literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) syntax for value substitution.

### Configuration file
```json
{
  ...
  "directoryPattern": "${author}/${series}",
  "filePattern": "${title} - ${trackNumber}${fileExtension}"
}
```
### Expected directory and file naming 
```
> J.K. Rowling
  ↳ Harry Potter 1
    ↳ Harry Potter and the Sorcerers Stone - 01.mp3
    ↳ Harry Potter and the Sorcerers Stone - 02.mp3
    ↳ Harry Potter and the Sorcerers Stone - 03.mp3
  ...
```

## Example book metadata structure
Book metadata can be used set the renaming patterns.  Use the JSON keys in the `directoryPattern` and `filePattern` configuration string to modify the naming process.
```json
{
  "author": "",        // The name of the book author
  "title": "",         // The title of the book
  "series": "",        // The name of the book series if one exists
  "trackNumber": "",   // The number of the current track/part
  "partCount": "",     // The total number of tracks/parts
  "directoryPath": "", // The path to the book files
  "filePath": "",      // The path to the current file
  "fileName": "",      // The name of the current file (without file extension)
  "fileExtension": ""  // The file extension of the current file including "."
}
```

## Examples of book metadata
Ernest Hemingway - The Old Man and the Sea 
```json
{
  "author": "Ernest Hemingway",
  "title": "The Old Man and the Sea",
  "series": "",
  "trackNumber": "1",
  "partCount": 6,
  "directoryPath": "./base/path/Ernest Hemingway/The Old Man and the Sea",
  "filePath": "./base/path/Ernest Hemingway/The Old Man and the Sea/The Old Man and the Sea - Part 01.mp3",
  "fileName": "The Old Man and the Sea - Part 1",
  "fileExtension": ".mp3"
}
```
J.K. Rowling - Harry Potter and the Sorcerer's Stone
```json
{
  "author": "J.K. Rowling",
  "title": "Harry Potter and the Sorcerer's Stone",
  "series": "Harry Potter 1",
  "trackNumber": "01",
  "partCount": 14,
  "directoryPath": "./base/path/J.K. Rowling/Harry Potter and the Sorcerers Stone",
  "filePath": "./base/path/J.K. Rowling/Harry Potter and the Sorcerers Stone/Harry Potter and the Sorcerers Stone - Part 1.mp3",
  "fileName": "Harry Potter and the Sorcerers Stone - Part 1",
  "fileExtension": ".mp3"
}
```
