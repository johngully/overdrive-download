import Logs from "../utils/logger.mjs";
import Mp3Files from "../mp3-files.mjs";
let logger = new Logs("debug");

const bookMetadata = {
  "author": "Ernest Hemingway",
  "title": "The Old Man and the Sea",
  "series": "",
  "description": "This short novel, already a modern classic, is the superbly told, tragic story of a Cuban fisherman in the Gulf Stream and the giant Marlin he kills and loses—specifically referred to in the citation accompanying the author's Nobel Prize for literature in 1954.",
  "coverImageUrl": "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1329189714l/2165._SY475_.jpg",
}

async function test() {
  const files = new Mp3Files();
  const result = await files.rename(bookMetadata);
  logger.debug(result);
}

await test();
