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
  var project = $("#tree").data("project");
  readFile(fileName, project, writeToEditorHandler);

  // set save button listener
  $(document).on("click", "#save-file", function() {
    var project = $("#tree").data("project");
    writeFile(fileName, project, editor.getValue());
  });

  // set build button listener
  $(document).on("click", "#build-source", function() {
    buildSource();
  });
}

// asynchronous file reader
function readFile(fileName, folder, handler) {
  $.ajax({
    url: "/read/" + fileName + "/" + folder
  }).done(function(data) {
    // write contents of file to editor
    // editor.setValue(data);
    handler(data);
  });
}

// asynchronous file write
function writeFile(fileName, folder, content) {
  $.ajax({
    type: "POST",
    url: "/write/" + fileName + "/" + folder,
    data: { content: content }
  }).done(function(data) {
    // TODO: display success status somewhere
  });
}

// asynchronous flac file write
function writeFlacFile(fileName, folder, content) {
  $.ajax({
    type: "POST",
    url: "/writeflac/" + fileName + "/" + folder,
    data: { content: content }
  }).done(function(data) {
    // TODO: display success status somewhere
  });
}

// asynchronous file write
function appendFile(fileName, folder, content) {
  $.ajax({
    type: "POST",
    url: "/append/" + fileName + "/" + folder,
    data: { content: content }
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
      var project = $("#tree").data("project");
      readFile(fileName, project, writeToEditorHandler);
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
  // read chat history, and write into chat box
  readFile("chat.json", "chat", writeToChatHandler);

  // prevent chat form from submitting
  $("#message-form").on("submit", function(e) {
    e.preventDefault();

    // only output into chat box if message entered
    var message = $.trim($("#message-input").val());
    if(message != "") {
      // get user display name
      var user = $("#chat-box").data("display-name");

      // write message to chat
      logChatMessage(user, MESSAGE_SOURCES.OUTGOING, message);

      //send message to dialogflow
      sendDialogFlow(message);

      // clear message box
      $("#message-input").val("");
    }
  });
}

const MESSAGE_SOURCES = { OUTGOING: 0, INCOMING: 1 };
function logChatMessage(user, source, content) {
  // get time stamp
  var date = new Date();
  var timeStampString = date.toLocaleDateString() + " " + date.toLocaleTimeString();

  // write in chat box
  writeToChat(user, source, content, timeStampString);

  // save chat output to log
  var message = { user: user, source: source, content: content, timeStamp: timeStampString };
  appendFile("chat.json", "chat", JSON.stringify(message) + "\n");
}

function writeToChat(user, source, content, timeStamp) {
  var messageClass = "";
  // change class based on whether message sent, or received
  if(source == MESSAGE_SOURCES.OUTGOING) {
    messageClass = "sent-message";
  } else if(source == MESSAGE_SOURCES.INCOMING) {
    messageClass = "received-message";
  }

  // append list item to li
  var rawLi = "<li class='" + messageClass + "'>" +
              "  <p class='message-details'><b>" + user + "</b> " + timeStamp + "</p>" +
              "  <p class='message-content'>" + content +"</p>" +
              "</li>";

  // add to chat
  $("#chat-history").append(rawLi);

  // scroll to bottom of chat box
  var chatContainer = document.getElementById("chat-history-container");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

//sends message to dialogflow
function sendDialogFlow(content){
  //ajax call to server
  $.ajax({
    type: "POST",
    url: "/sendToDialogFlow",
    data: { content: content }
  }).done(function(data) {
    //pass dialogflow response to chat window
    var user = "videBot";
    logChatMessage(user, MESSAGE_SOURCES.INCOMING, data);
  });
}

// handlers for acting on data read from files
// write to ace editor
function writeToEditorHandler(data) {
  // simply write entire file output to editor
  editor.setValue(data);
}

// write to chat box
function writeToChatHandler(data) {
  // only display in the chat box if message exist
  var messageLog = data.split("\n");
  if(messageLog.length > 0) {
    $.each(messageLog, function(i, rawMessage) {
      try {
        // convert saved chat message to json
        var message = JSON.parse(rawMessage);

        // write message data to chat
        writeToChat(message["user"], message["source"], message["content"], message["timeStamp"]);
      } catch (e) {
        console.log("trying to parse trailing empty line... need to fix");
      }
    });
  }
}

// sets up voice recording, and communication with google translate
function createVoiceRecorder() {
  var recorder = document.getElementById("recorder");

  if(navigator.mediaDevices){
	//add constraints object
	var constraints = { audio: true };
	var chunks = [];

     //call getUserMedia, then the magic
     navigator.mediaDevices.getUserMedia(constraints).then(function(mediaStream) {
		// setup media recorder
		var mediaRecorder = new MediaRecorder(mediaStream);

		// record when pressed
		 recorder.onclick = function() {
			 recorder.value = "Stop";
			 mediaRecorder.start();
		 }
		 
		 mediaRecorder.onstart = function(e){
		   // stop recording when pressed
		   recorder.onclick = function() {
			 recorder.value = "Record";
			 mediaRecorder.stop();
		   }
	}
	
	   
       // process media when stopped
       mediaRecorder.onstop = function(e) {
         // set recording format
         var blob = new Blob(chunks, { type : 'audio/ogg; codecs=opus' });

         // read recorded value to binary
         var reader = new FileReader();
         reader.readAsBinaryString(blob);
         reader.onloadend = function() {
           // send to back end to be saved and converted
           writeFlacFile("recording.flac", "voice", reader.result);
         }

         chunks = [];
		 
	//reset mediaRecorder settings
	recorder.onclick = function() {
		recorder.value = "Stop";
         	mediaRecorder.start();
	}
}

      // asynchronous flac file write
      function writeFlacFile(fileName, folder, content) {
        $.ajax({
          type: "POST",
          url: "/writeflac/" + fileName + "/" + folder,
          data: { content: content }
        }).done(function(data) {
            // username
            var user = $("#chat-box").data("display-name");

            // write in chat box
            logChatMessage(user, MESSAGE_SOURCES.OUTGOING, data);

            //send message to dialogflow
            sendDialogFlow(data);
          });
        }

      mediaRecorder.ondataavailable = function(e) {
        chunks.push(e.data);
      }
    }).catch(function(err){
      console.log("yikes, an err!" + err.message);
    });
  }
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
  // only setup voice recorder on ide page
  // only setup chat box on ide page
  if($("#chat-box").length == 1) {
    createVoiceRecorder();
  }
});
