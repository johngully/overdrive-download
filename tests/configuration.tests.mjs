import Logs from "../utils/logger.mjs";
import Configuration from "../utils/configuration.mjs";
let logger = new Logs("debug");

const configuration = new Configuration();

// Get configuration
const config = configuration.load();
logger.debug(config);

const username = config.username;
logger.debug("Username:", username);

// Change configuration
configuration.set("username", "foo");
const newUsername = configuration.get("username");
logger.debug("Username:", username);
logger.debug("New Username:", newUsername);

// Save changes
configuration.save();
configuration.save(config);
