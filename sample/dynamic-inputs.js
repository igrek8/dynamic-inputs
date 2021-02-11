const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

module.exports = async (cwd) => {
  const source = path.resolve(cwd, "services.yml");
  const content = fs.readFileSync(source).toString("utf-8");
  return Object.keys(yaml.parse(content).services);
};
