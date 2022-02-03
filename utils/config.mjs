import { v4 as uuidv4 } from 'uuid';
import fs from "fs";
import path from "path";

export default class Config {
  configFilePath = "";
  config = {};

  constructor(explicitConfigPath) {
    this.configFilePath = getConfigFileName(explicitConfigPath);
  }

  getConfig() {
    let configString = "";
    const configExists = fs.existsSync(this.configFilePath);
    if (configExists) {
      configString = fs.readFileSync(this.configFilePath).toString();
    }
    
    if (configString) {
      this.config = JSON.parse(configString);
    } else {
      this.config = {}
    }

    return this.config;
  }

  saveConfig(config) {
    const data = config ? config : this.config;
    fs.writeFileSync(this.configFilePath, JSON.stringify(data));
  }

  exists() {
    return fs.existsSync(this.configFilePath);
  }
}

function getConfigFileName(explicitFileName) {
  const defaultFileName = `.${path.basename(path.resolve())}rc`;
  const fileName = explicitFileName || defaultFileName;
  return fileName;
}



// function getClientId(config) {
//   if (config.uuid) {
//     return config.uuid;
//   }

//   config.uuid = uuidv4();
//   rcConfig.saveConfig(config);
//   return config.uuid;
// }

// const rcConfig = new Config();
// const config = rcConfig.getConfig();
// const clientId = getClientId(config);
// console.log("clientId", clientId)