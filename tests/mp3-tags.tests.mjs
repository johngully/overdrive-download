import Mp3Tags from "../mp3-tags.mjs";

const bookPath = "./downloads/Ernest Hemingway/The Old Man and the Sea";
const bookMetadata = {
  "author": "Ernest Hemingway",
  "title": "The Old Man and the Sea",
  "series": "",
  "description": "This short novel, already a modern classic, is the superbly told, tragic story of a Cuban fisherman in the Gulf Stream and the giant Marlin he kills and loses—specifically referred to in the citation accompanying the author's Nobel Prize for literature in 1954.",
  "partCount": 6
}
const options = { titlePattern: "${title} - Part ${trackNumber}" };

async function test() {
  const tags = new Mp3Tags();
  const result = await tags.normalizeTags(bookPath, bookMetadata, options);
  console.log(result);
}

await test();
