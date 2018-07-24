// socket global, commands can be entered from other elements
var socket;
function createTerminal() {
  // apply fit addon, so that size of terminal can be fitted to container
  Terminal.applyAddon(fit);

  // create terminal object
  var term = new Terminal();

  // open xterm
  term.open(document.getElementById("terminal"));

  // set xterm display properties
  term.setOption("fontFamily", "monospace");
  term.setOption("fontSize", "14");

  // fit the terminal to dimensions of container
  term.fit();

  // retrieve domain and port, in order to set up web socket
  $terminal = $("#terminal");
  var aquariusDomain = $terminal.data("aquarius-domain");
  var aquariusPort = $terminal.data("aquarius-port");

  // sets up websocket
  var socketURL = 'ws://' + aquariusDomain + ':' + aquariusPort + '/';
  socket = new WebSocket(socketURL);

  socket.onopen = function() {
    // write response to xterm console, when received
    socket.addEventListener("message", function(res) {
      // write response from server to console
      term.write(res.data);
    });

    // handle xterm intput
    term.on("data", function(data) {
      // send user input to server, for terminal to execute
      socket.send(data);
    });

    // cd into project, after connection to the terminal has been established
    cdProject();
  }

  $(window).resize(function() {
    // re-fit the terminal to dimensions of container
    term.fit();
  });
}

// move user to project
function cdProject() {
  // retrieve user workspace folder name
  $tree = $("#tree");
  var namespace = $tree.data("namespace");
  var project = $tree.data("project");

  // cd to project
  socket.send("cd ./workspaces/" + namespace + "/" + project + "\n");
  // clear terminal, so user starts fresh
  socket.send("clear \n");
}

// global values, to allow communication between editor and nav tree
var editor = null;
var fileName = "";
function createEditor() {
  // initialize ace editor
  editor = ace.edit("editor");

  // set editor theme
  editor.setTheme("ace/theme/monokai");

  // set syntax highlighting
  editor.getSession().setMode("ace/mode/c_cpp");

  // set default file, and load
  fileName = "main.cpp";
  readFile();

  // set save button listener
  $(document).on("click", "#save-file", function() {
    writeFile();
  });

  // set build button listener
  $(document).on("click", "#build-source", function() {
    buildSource();
  });
}

// asynchronous file reader
function readFile() {
  $.ajax({
    url: "/read/" + fileName
  }).done(function(data) {
    // write contents of file to editor
    editor.setValue(data);
  });
}

// asynchronous file write
function writeFile() {
  $.ajax({
    type: "POST",
    url: "/write/" + fileName,
    data: { content: editor.getValue() }
  }).done(function(data) {
    // TODO: display success status somewhere
  });
}

// compile, and run source
function buildSource() {
  // only compile if a c++ file is being viewed, and in project dir
  if(fileName.match(/\.cpp$/)) {
    // retrieve user workspace folder name
    $tree = $("#tree");
    var rootPath = $tree.data("root-path");
    var namespace = $tree.data("namespace");
    var project = $tree.data("project");

    // make sure the in project
    socket.send("cd " + rootPath + "/workspaces/" + namespace + "/" + project + "\n");

    // timestamp build
    var date = new Date();
    var timeStampString = date.getYear().toString() + "-" +
                          date.getMonth().toString() + "-" +
                          date.getDate().toString() + "-" +
                          date.getHours().toString() + "-" +
                          date.getMinutes().toString() + "-" +
                          date.getSeconds().toString();
    var outputName = "build" + timeStampString;

    // console.log("../builds/" + outputName);

    // compile
    socket.send("g++ " + fileName + " -o ../builds/" + outputName + " \n");

    // run
    socket.send("../builds/" + outputName + " \n");
  }
}

function createNavTree() {
  // retrieve user workspace folder name
  $tree = $("#tree");
  var namespace = $tree.data("namespace");

  // using default options
  $tree.fancytree({
    source: {
      url: "/" + namespace + "/tree/data.json",
      cache: false
    },
    //TODO add functionality for clicked files to load into text editor
    activate: function(event, data) {
      // read and display selected file
      fileName = data.node.title;
      readFile();
    },
    beforeSelect: function(event, data) {
      // A node is about to be selected: prevent this, for folder-nodes:
      if(data.node.isFolder()) {
        return false;
      }
    }
  });
}

function createChatBox() {
  // prevent chat form from submitting
  $("#message-form").on("submit", function(e) {
    e.preventDefault();

    // only output into chat box if message entered
    var message = $.trim($("#message-input").val());
    if(message != "") {
      // get user display name
      var user = $("#chat-box").data("display-name");

      // write message to chat
      writeToChat(user, MESSAGE_SOURCES.OUTGOING, message);

      // clear message box
      $("#message-input").val("");
    }
  });
}

const MESSAGE_SOURCES = { OUTGOING: 0, INCOMING: 1 };
function writeToChat(user, source, content) {
  // get time stamp
  var date = new Date();
  var timeStampString = date.toLocaleDateString() + " " + date.toLocaleTimeString();

  var messageClass = "";
  // change class based on whether message sent, or received
  if(source == MESSAGE_SOURCES.OUTGOING) {
    messageClass = "sent-message";
  } else if(source == MESSAGE_SOURCES.INCOMING) {
    messageClass = "received-message";
  }

  // append list item to li
  var rawLi = "<li class='" + messageClass + " data-user='" + user + "' data-time='" + timeStampString + "' data-content='" + content + "'>" +
              "  <p class='message-details'><b>" + user + "</b> " + timeStampString + "</p>" +
              "  <p class='message-content'>" + content +"</p>" +
              "</li>";

  $("#chat-history").append(rawLi);

  // scroll to bottom of chat box
  var chatContainer = document.getElementById("chat-history-container");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// setup ide after document is ready
$(document).ready(function() {
  // only setup terminal on ide page
  if($("#terminal").length == 1) {
    createTerminal();
  }
  // only setup editor on page with editor element
  if($("#editor").length == 1) {
    createEditor();
  }
  // only setup nave tree on ide page
  if($("#tree").length == 1) {
    createNavTree();
  }
  // only setup chat box on ide page
  if($("#chat-box").length == 1) {
    createChatBox();
  }
});
