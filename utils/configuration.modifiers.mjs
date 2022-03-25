import { v4 as uuidv4 } from "uuid";

function clientIdDefault(config) {
  if (config.get("clientId")) {
    return;
  }

  const clientId = uuidv4();
  config.set("clientId", clientId);
  // console.log("clientIdDefault", clientId);
  return true;
}

function urlDefault(config) {
  if (config.get("url")) {
    return;
  }

  const libraryName = config.get("libraryName");
  const urlBase = config.get("urlBase");
  const url = `https://${libraryName}.${urlBase}`;
  config.set("url", url);
  // console.log("urlDefault", url);
  return true;
}

export default [ 
  clientIdDefault, 
  urlDefault 
];