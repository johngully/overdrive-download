import fs from "fs";
import path from "path";
import { URL } from "url";
import convict from "convict";
import convictFormatWithValidator from "convict-format-with-validator";
import modifiers from "./configuration.modifiers.mjs";

const CONFIG_FILE_NAME = ".overdrivedownloadrc";

export default class Configuration {
  _customConfigFilePath = null;
  currentConfigFile = null;
  config = null;

  constructor(customConfigFilePath) {
    if (customConfigFilePath) {
      this._customConfigFilePath = customConfigFilePath;
    }

    // Load the schemas from the various schema files
    const configSchema = getSchemas();

    // Configure and setup Convict
    convict.addFormats(convictFormatWithValidator);
    this.config = convict(configSchema);
  }

  exists() {
    return fs.existsSync(this.currentConfigFile);
  }

  load(configFilePath) {
    // Add the global config by default
    const globalConfigPath = getGlobalConfigFilePath();
    loadConfigFile(this.config, globalConfigPath);
    this.currentConfigFile = globalConfigPath;

    // Add the custom config if specified
    const customConfigFilePath = configFilePath ? configFilePath : this._customConfigFilePath;
    if (customConfigFilePath) {
      loadConfigFile(this.config, customConfigFilePath);
      this.currentConfigFile = customConfigFilePath;
    }

    // Once the values are loaded, run the dynamic value modifiers
    const configHasChanged = runValueModifiers(this.config);

    // Ensure the config is valid    
    this.config.validate();

    // Save any dynamic value change
    if (configHasChanged) {
      this.save();
    }

    // Return the full configuration value set
    return this.config.get();
  }

  save(config) {
    const data = config ? config : this.config.get();
    fs.writeFileSync(this.currentConfigFile, JSON.stringify(data));
  }

  get(...args) {
    return this.config.get(...args)
  }

  set(...args) {
    return this.config.set(...args)
  }
}

function getSchemas() {
  // Consider using a pattern to find all the .schema files
  const internalSchema = getJsonFromFile("./utils/configurationInternal.schema.json");
  const configSchema = getJsonFromFile("./utils/configuration.schema.json");

  return {
    ...internalSchema,
    ...configSchema
  }
}

function runValueModifiers(config) {
  const hasChanges = modifiers.map(modifier => modifier(config)).some(value => value);
  return hasChanges;
}

function loadConfigFile(config, path) {
  const fileExists = fs.existsSync(path);
  if (fileExists) {
    config.loadFile(path);
  }
  return fileExists;
}

function getGlobalConfigFilePath() {
  // Get the path the config file in the package installation location.
  // This is needed if the user is executing the code from another location,
  // such as through the CLI.
  const __dirname = path.dirname(new URL(".", import.meta.url).pathname);
  const globalConfigFilePath = path.join(__dirname, CONFIG_FILE_NAME);
  return globalConfigFilePath;
}

function getJsonFromFile(schemaPath) {
  const schema = fs.readFileSync(schemaPath);
  return JSON.parse(schema);
}
