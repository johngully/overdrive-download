import { v4 as uuidv4 } from 'uuid';
import fs from "fs";
import path from "path";
import { URL } from 'url';

// Normally `new URL(".", import.meta.url).pathname` would be sufficient
// however since import.meta.url returns /utils/config.mjs 
// use path.dirname() to go to the parent directory
const __dirname = path.dirname(new URL(".", import.meta.url).pathname);
const cwd = process.cwd();
const defaultConfigFileName = ".overdrivedownloadrc";

export default class Config {
  configFilePath = "";
  config = {};

  constructor(explicitConfigPath) {
    const configFileName = explicitConfigPath || defaultConfigFileName; 
    this.configFilePath = getConfigFilePath(configFileName);
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

function getConfigFilePath(configFileName) {
  const currentConfigFilePath = path.join(cwd, configFileName);
  const packageConfigFilePath = path.join(__dirname, configFileName);

  // By default use the package config file path
  let configFilePath = packageConfigFilePath;

  // Override the package config file if a local file exists
  if (fs.existsSync(currentConfigFilePath)) {
    configFilePath = currentConfigFilePath;
  } 

  return configFilePath;
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
