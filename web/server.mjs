import express, { json } from "express";
import cors from "cors";
import path from "path";
import { URL } from "url";
import Configuration from "../utils/configuration.mjs";
import OverdriveDownload from "../index.mjs";

// NOTES: 
// For debugging the following lines can be used to mock the implementation
//
// import OverdriveDownloadMocks from "../tests/OverdriveDownload.mocks.mjs";
// const odmMocks = new OverdriveDownloadMocks();
// odmMocks.mock(OverdriveDownload);

const configuration = new Configuration();
const config = configuration.load();
const PORT = config.server.port;
const __filename = new URL("", import.meta.url).pathname;
const __dirname = new URL(".", import.meta.url).pathname; // Will contain trailing slash

// Setup the web server middleware
const app = express();
app.use(cors());
app.use(json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Returns the download.html files
app.get("/", async (request, response) => {
  console.log(`/ -`, `url: "${request.url}"`);
  const downloadFilePath = path.join(__dirname, '/download.html');
  response.sendFile(downloadFilePath);
  console.log(`/ -`, `transferred "download.html"`);
});

// Downloads the specified audiobook and returns the audiobook information
app.get("/download", async (request, response) => {
  const title = request.query?.title;
  console.log(`/download -`, `url: "${request.url}"`);
  const odm = new OverdriveDownload();
  const result = await odm.download(title);
  response.json(result);
  console.log(`/download -`, `Downloaded ${result.book.partCount} parts to: "${result.book.path}"`)
});

// Start the web server on the specified port
app.listen(PORT, () => console.log(`Overdrive Download server listening on port: ${PORT}`));
