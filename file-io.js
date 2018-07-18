const fs = require('fs');

// helper for building namespaced file paths
function filePath(fileName, userID) {
  return ("./workspaces/" + userID + "/" + fileName);
}

// private helpers
function buildNamespace(userID) {
  // console.log(userID);
  if (!fs.existsSync("./workspaces/" + userID)){
    fs.mkdirSync("./workspaces/" + userID);
  }
}

function readUserFile(fileName, userID) {
  var path = filePath(fileName, userID);

  // create file if does not exist
  if (!fs.existsSync(path)){
    writeUserFile(fileName, '', userID);
    console.log(filePath + " created!");
  }

  // return content of file
  return fs.readFileSync(path);
}

function writeUserFile(fileName, fileContent, userID) {
  var path = filePath(fileName, userID);

  // write value over file
  fs.writeFile(path, fileContent, function (err) {
    if (err) {
      throw err;
    }
  });
}

//create export
module.exports = {
  // reads files from user namespace
  readFile: function(fileName, userID) {
    // setup user directory, if it does not exist
    buildNamespace(userID);

    // load or build file
    return readUserFile(fileName, userID);
  },

  // writes files to user namespace
  writeFile: function(fileName, fileContent, userID) {
    // setup user directory, if it does not exist
    buildNamespace(userID);

    // write data to file
    writeUserFile(fileName, fileContent, userID);
  }
};
