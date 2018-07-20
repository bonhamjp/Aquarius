const fs = require("fs");

const ROOT_SPACE = "./workspaces/";

// helper for building namespaced project path
function projectPath(namespace, project) {
  return ROOT_SPACE + namespace + "/" + project;
}

// helper for building namespaced file path
function filePath(fileName, namespace, project) {
  return ROOT_SPACE + namespace + "/" + project + "/" + fileName;
}

// private helpers
function readUserFile(fileName, namespace, project) {
  var path = filePath(fileName, namespace, project);

  // create file if does not exist
  if (!fs.existsSync(path)){
    writeUserFile(fileName, "", namespace, project);
    console.log(path + " created!");
  }

  // return content of file
  return fs.readFileSync(path);
}

function writeUserFile(fileName, fileContent, namespace, project) {
  var path = filePath(fileName, namespace, project);

  // write value over file
  fs.writeFile(path, fileContent, function (err) {
    if (err) {
      throw err;
    }
  });
}

//create export
module.exports = {
  // builds directory, if it does not yet exist
  buildProject: function(namespace, project) {
    // var path = projectPath(namespace, project);
    var path = ROOT_SPACE + namespace;

    // check if user namespace exists
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }

    // project path
    path += "/" + project;

    // check if project exists
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  },

  // builds file, if it does not yet exist
  buildFile: function(namespace, project, fileName) {
    var path = filePath(fileName, namespace, project);

    // check if file exists
    if (!fs.existsSync(path)) {
      writeUserFile(fileName, "", namespace, project);
    }
  },

  // reads files from user namespace
  readFile: function(fileName, namespace, project) {
    // setup project, if it does not exist
    this.buildProject(namespace, project);

    // load or build file
    return readUserFile(fileName, namespace, project);
  },

  // writes files to user namespace
  writeFile: function(fileName, fileContent, namespace, project) {
    // setup project, if it does not exist
    this.buildProject(namespace, project);

    // write data to file
    writeUserFile(fileName, fileContent, namespace, project);
  }
};
