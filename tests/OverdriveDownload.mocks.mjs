export default class OverdriveDownloadMocks {
  asyncDelay = 3000;
  downloadResultFixture = downloadResultWithFullPayload;

  constructor(options) {
    if (options) {
      this.downloadResultFixture = options?.downloadResultFixture;
      this.asyncDelay = options?.asyncDelay;  
    }
  }

  mock(odm) {
    // Mock either the OverdriveDownload Class or the instance of the OverdriveDownload
    const odmObject = odm.prototype ? odm.prototype : odm;
    odmObject.download = (title) => this.download(title);
  }

  async download(title) {
    await sleep(this.asyncDelay);
    return await this.downloadResultFixture;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const downloadResultWithFullPayload = {
  "completed": {
    "odm": true,
    "mp3": true,
    "rename": true,
    "tag": true,
    "cleanup": true
  },
  "book": {
    "path": "downloads/Andrew Peterson/The Monster in the Hollows",
    "partCount": 8,
    "metadata": {
      "author": "Andrew Peterson",
      "title": "The Monster in the Hollows",
      "subTitle": "The Wingfeather Saga Series, Book 3",
      "series": "The Wingfeather Saga",
      "description": "<b>Things are about to go from bad to wolf in the howlingly entertaining third book of the Wingfeather Saga.</b><br><br> Janner, Tink, and Leeli Igiby, the Lost Jewels of Anniera, are hiding from Gnag the Nameless in the Green Hollows, one of the few places in the land of Aerwiar not overrun by the Fangs of Dang. But there's a big problem. Janner's little brother—heir to the throne of Anniera—has grown a tail. And gray fur. Not to mention two pointed ears and long, dangerous fangs. To the suspicious folk of the Green Hollows, he looks like a monster.<br><br> But Janner knows better. His brother isn't as scary as he looks. He's perfectly harmless. Isn't he?<br><br> Full of characters rich in heart, smarts, and courage, <i>The Monster in the Hollows</i> is a tale children of all ages will cherish, families can listen to together, and book clubs are sure to enjoy discussing for its many layers of meaning.",
      "coverImageUrl": "https://images.contentreserve.com/ImageType-100/1191-1/{D61500DC-DDBC-4443-AE34-D8244C669896}Img100.jpg",
      "partCount": 8
    },
    "files": [
      [
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 01.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 02.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 03.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 04.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 05.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 06.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 07.mp3",
        "downloads/Andrew Peterson/The Monster in the Hollows/The Monster in the Hollows - Part 08.mp3"
      ]
    ]
  }
};