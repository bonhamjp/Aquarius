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
    terminalCdProject();
  }

  $(window).resize(function() {
    // re-fit the terminal to dimensions of container
    term.fit();
  });
}

// terminal commands
function terminalSetWorkingDirectory() {
  // retrieve user workspace folder name
  $tree = $("#tree");
  var namespace = $tree.data("namespace");
  var project = $tree.data("project");

  // cd to project
  socket.send("cd ./workspaces/" + namespace + "/" + project + "\n");
}

// move user to project
function terminalCdProject() {
  // make sure in user project directory
  terminalSetWorkingDirectory();

  // clear terminal, so user starts fresh
  socket.send("clear \n");
}

// create file
function terminalCreateFile(filename, callback) {
  // make sure in user project directory

  //terminalSetWorkingDirectory();    //Commenting out cause it's causing a bug in the terminal.

  // make file
  socket.send("touch " + filename + "\n");

}

// delete file
function terminalDeleteFile(filename) {
  // make sure in user project directory
  terminalSetWorkingDirectory();

  // make file
  socket.send("rm " + filename + "\n");
}

// global values, to allow communication between editor and nav tree
var editor = null;
var fileName = "";
function createEditor() {
  // initialize ace editor
  editor = ace.edit("editor");

  // increase font
  editor.setOptions({ fontSize: "12pt" });

  // set editor theme
  // editor.setTheme("ace/theme/monokai");
  editor.setTheme("ace/theme/solarized_dark");

  // set syntax highlighting
  editor.getSession().setMode("ace/mode/c_cpp");

  // set default file, and load
  fileName = "main.cpp";
  var project = $("#tree").data("project");
  readFile(fileName, project, writeToEditorHandler);

  // set save button listener
  $(document).on("click", "#save-file", function(e) {
    e.preventDefault();

    var project = $("#tree").data("project");
    writeFile(fileName, project, editor.getValue());
  });

  // set build button listener
  $(document).on("click", "#build-source", function(e) {
    e.preventDefault();

    buildSource();
  });
}

// ace text editor interface
function aceFormat() {
  // setup beautify
  var beautify = ace.require("ace/ext/beautify");

  // beatify the file
  beautify.beautify(editor.session);
}

function aceAddLinesAt(row, lines) {
  // must interact with editor session
  var session = editor.session;

  // number of lines to insert
  var numberOfLinesToAdd = lines.length;

  // determine which row to add line to
  var targetRow = row;

  // calculate which row to add to, if a row was not passed
  if(targetRow == null) {
    // get current cursor position
    var cursorPosition = editor.getCursorPosition();

    // get line at cursor position
    var currentLine = session.getLine(cursorPosition["row"]);

    // set to next row, if at the end of a non-empty row
    if($.trim(currentLine).length > 0 && cursorPosition["column"] == currentLine.length) {
      targetRow = cursorPosition["row"] + 1;

    // else stay on current row
    } else {
      targetRow = cursorPosition["row"];

    }
  } else {
    // row uses 0 index internally, but we use line actual line numbers
    // when calling ace helper functions, to make things cleaner
    targetRow -= 1;
  }

  // add line by line
  for(var i = 0;i < numberOfLinesToAdd;i++) {
    // add a new line
    aceExtendFileEnd();

    // move existing lines down
    session.moveLinesDown((targetRow), (session.getLength() - 1));

    // insert line
    session.insert({ "row": (targetRow), "column": 0 }, lines[i] + "\n");

    // move to next line
    targetRow++;
  }

  // make sure everything is formatted correctly
  aceFormat();

  // if the last line added was an ending brace, put the cursor inside the brace
  if($.trim(session.getLine(targetRow - 1)) == "}") {
    // move to previous line
    aceMoveCursorTo(targetRow - 1);

    // else put the cursor on the next line
  } else {
    // move to next line
    aceMoveCursorTo(targetRow + 1);
  }
}

function aceExtendFileEnd() {
  // must interact with editor session
  var session = editor.session;

  // add another line to file
  session.insert({ "row": (session.getLength() + 1), "column": 0 }, "\n");
}

function aceAddNewLine(row) {
  aceAddLinesAt(row, [""]);
}

function aceRemoveLineAt(row) {
  // must interact with editor session
  var session = editor.session;

  // must use Range type to replace lines
  var Range = require("ace/range").Range;

  // replace with empty line
  session.replace(new Range((row - 1), 0, (row -1), Number.MAX_VALUE), "");

  // move remaining lines up
  session.moveLinesUp(Number(row), session.getLength());

  // make sure everything is formatted correctly
  aceFormat();

  // move to next line
  aceMoveCursorTo(row);
}

function aceMoveCursorTo(row, goToEnd) {
  // specify cursor should go to beginning of line, unless other specified otherwise
  var column = 0;

  // find end of line, if specified
  if(goToEnd) {
    var session = editor.session;
    column = session.getLine(row - 1).length;
  }

  // set editor cursor position
  editor.gotoLine(row, column);
}

// asynchronous file reader
function readFile(fileName, folder, handler) {
  $.ajax({
    url: "/read/" + fileName + "/" + folder
  }).done(function(data) {
    // write contents of file to editor
    handler(data);
  });
}

// asynchronous file write
function writeFile(fileName, folder, content, handler) {
  $.ajax({
    type: "POST",
    url: "/write/" + fileName + "/" + folder,
    data: { content: content }
  }).done(function(data) {
    // call handler, if passed
    if(handler != null) {
      handler(data);
    }
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
  updateNavTree();
}

// syncs nav tree with current file structure, and loads
function updateNavTree() {
  //ajax call to server
  $.ajax({
    type: "POST",
    url: "/syncNavTree"
  }).done(function(data) {
    // display current file structure
    displayNavTree();
  });

}

function displayNavTree() {
  // retrieve user workspace folder name
  $tree = $("#tree");
  var namespace = $tree.data("namespace");

  // using default options
  $tree.fancytree({
	icon: function(event, data){
		if(String(data.node.data.path).match(/\.cpp$/)){
			return "cpppp-490x490.png";
		}
		else if(String(data.node.data.path).match(/\.h$/)){
			return "header.png";
		}
		else
			return "file.png";
	},
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

function navTreeFileExists(filename) {
  var fileFound = false;
  $(".fancytree-title").each(function() {
    if($(this).text() == filename) {
      fileFound = true;
    }
  });

  return fileFound;
}

function navTreeChangeToFile(filename) {
  var fileFound = false;
  $(".fancytree-title").each(function() {
    if($(this).text() == filename) {
      $(this).click();
    }
  });

  return fileFound;
}

function createChatBox() {
  // read chat history, and write into chat box
  readFile("chat.json", "chat", writeToChatHandler);

  // clears, and loads blank history, when clicked
  $("#erase-chat-log").on("click", function(e) {
    e.preventDefault();

    // require confirmation
    if(confirm("This will permanently clear the chat history. Do you want to clear history?")) {
      // clear chat file
      writeFile("chat.json", "chat", "", function(data) {
        // read chat history, and write into chat box
        readFile("chat.json", "chat", writeToChatHandler);
      });
    }
  });

  // parse and log check when send button clicked
  $("#message-submit").on("click", function(e) {
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

const MESSAGE_SOURCES = { OUTGOING: 0, INCOMING: 1, ERROR: 2 };
function logChatMessage(user, source, content) {
  // get time stamp
  var date = new Date();
  var timeStampString = date.toLocaleDateString() + " " + date.toLocaleTimeString();

  // write in chat box
  writeToChat(user, source, content, timeStampString, true);

  // save chat output to log
  var message = { user: user, source: source, content: content, timeStamp: timeStampString };
  appendFile("chat.json", "chat", JSON.stringify(message) + "\n");
}

function writeToChat(user, source, content, timeStamp, animate) {
  var messageClass = "";
  // change class based on whether message sent, or received
  if(source == MESSAGE_SOURCES.OUTGOING) {
    messageClass = "sent-message";
  } else if(source == MESSAGE_SOURCES.INCOMING) {
    messageClass = "received-message";
  } else if(source == MESSAGE_SOURCES.ERROR) {
    messageClass = "error-message";
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

  // only animate when argument set
  if(animate) {
    // newly appended message
    $latestMessage = $("#chat-history li:last");

    // change new message to blue
    $latestMessage.css("backgroundColor", "#dee2e6");

    // animate new back to normal backgroundColor
    $("#chat-history li:last").animate({
      backgroundColor: "#ffffff"
    }, 1000);
  }
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
    logChatMessage(user, MESSAGE_SOURCES.INCOMING, data.fulfillmentText);
    //only call dialogflow handler if there is an action
    if (data.action != "None"){
	    dialogflowHandler(data);
    }
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
  // clear chat history
  $("#chat-history li").remove();

  // only display in the chat box if message exist
  var messageLog = data.split("\n");
  if(messageLog.length > 0) {
    $.each(messageLog, function(i, rawMessage) {
      try {
        // convert saved chat message to json
        var message = JSON.parse(rawMessage);

        // write message data to chat
        writeToChat(message["user"], message["source"], message["content"], message["timeStamp"], false);
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
			 recorder.innerHTML = "Stop";
			 mediaRecorder.start();
		 }

		 mediaRecorder.onstart = function(e){
		   // stop recording when pressed
		   recorder.onclick = function() {
			 recorder.innerHTML = "Record";
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
         recorder.innerHTML = "Stop";
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

// dialogflow error messaging
function logDialogflowError(errorMessage) {
  // log and pass dialogflow error response to chat window
  var user = "videBot";
  logChatMessage(user, MESSAGE_SOURCES.ERROR, errorMessage);
}

// suite of dialogflow handlers
function dialogflowCreateFileHandler(filename) {
  if(filename != null && !navTreeFileExists(filename)) {
    // create new file
    terminalCreateFile(filename);

    // refresh nav tree
    setTimeout(updateNavTree, 500);

  } else {
    logDialogflowError("The file already exists. Sorry! Please try again.");
  }
}

function dialogflowDeleteFileHandler(filename) {
  if(filename != null && navTreeFileExists(filename)) {
    // delete file
    terminalDeleteFile(filename);

    // refresh nav tree
    setTimeout(updateNavTree, 500);

  } else {
    logDialogflowError("The file does not exist. Sorry! Please try again.");
  }
}

function dialogflowChangeFileHandler(filename) {
  if(filename != null && navTreeFileExists(filename)) {
    // switch to file
    navTreeChangeToFile(filename);
  } else {
    logDialogflowError("The file does not exist. Sorry! Please try again.");
  }
}

function dialogflowSaveFileHandler() {
  $("#save-file").click();
}

function dialogflowCompileFileHandler() {
  $("#build-source").click();
}

function dialogflowAddInclude(headerName, localHeader) {
  if(headerName != null) {
    var lines = []

    // if value is defined, add setter in line
    if(localHeader) {
      lines.push("#include " + "\"" + headerName + "\"");
    // else only declare variable
    } else {
      lines.push("#include " + "<" + headerName + ">");
    }

    aceAddLinesAt(0, lines);
  } else {
    logDialogflowError("You need to specify a header file name. Sorry! Please try again.");
  }
}

function dialogflowMoveCursorHandler(row, goToEnd) {
  aceMoveCursorTo(row, goToEnd);
}

function dialogflowAddNewLineHandler(row) {
  if(row != null) {
    aceAddNewLine(row);
  } else {
    logDialogflowError("You need to specify which row you would like to add a newline to. Sorry! Please try again.");
  }
}

function dialogflowDefaultTempHandler(){
   var include = []
   include.push("#include<iostream>");
   aceAddLinesAt(1, include);

   var namespace = []
   namespace.push("using namespace std;");
   aceAddLinesAt(2, namespace);

   var mainFunction = []
   mainFunction.push("int main()");
   aceAddLinesAt(6, mainFunction);

   var firstBrack = []
   firstBrack.push("{");
   firstBrack.push("// Add code here");
   aceAddLinesAt(7, firstBrack);

   var returnZero = []
   returnZero.push("return 0;");
   aceAddLinesAt(10, returnZero);

   var lastBrack = []
   lastBrack.push("}");
   aceAddLinesAt(11, lastBrack);
}

function dialogflowPrintHandler(row, content){
  if(content != null){
    var printText = [];
    printText.push("std::cout << \"" + content + "\" << std::endl;");
    aceAddLinesAt(row, printText);
  }
}

function dialogflowAddVariableHandler(row, type, name, value) {
  if(type != null && name != null) {
    var lines = []
    console.log("In Handler...Type = " + type);
    // if type is string, add quotes
    if(type  == "string") {
      lines.push(type + " " + name + " = " + "\"" + value + "\";");
    // else only declare variable
    } else {
      lines.push(type + " " + name + " = " + value + ";");
    }

    aceAddLinesAt(row, lines);
  } else {
    logDialogflowError("Missing values needed to create a variable. Sorry! Please try again.");
  }
}

function dialogflowAddForLoopHandler(row, counterVar, startingNumber, conditional, direction, incrementor) {
  if(counterVar != null && startingNumber != null && conditional != null && direction != null && incrementor != null) {
    var lines = []
    lines.push("for (int " + counterVar + " = " + startingNumber + ";" + conditional + ";" + counterVar + direction + "=" + incrementor + ") {");
    lines.push("// Add code here");
    lines.push("}");

    aceAddLinesAt(row, lines);
  } else {
    logDialogflowError("Missing values needed to create a for loop. Sorry! Please try again.");
  }
}

function dialogflowAddWhileLoopHandler(row, conditional) {
  if(conditional != null) {
    var lines = []
    lines.push("while (" + conditional + ") {");
    lines.push("// Add code here");
    lines.push("}");

    aceAddLinesAt(row, lines);
  } else {
    logDialogflowError("Missing values needed to create a while loop. Sorry! Please try again.");
  }
}

function dialogflowAddIfHandler(row, conditional) {
  if(conditional != null) {
    var lines = []
    lines.push("if (" + conditional + ") {");
    lines.push("// Add code here");
    lines.push("}");

    aceAddLinesAt(row, lines);
  } else {
    logDialogflowError("Missing values needed to create an if statement. Sorry! Please try again.");
  }
}

function dialogflowAddElseHandler(row, conditional) {
  // must add to a row with an ending curly brace
  var lineToAddTo = row;
  if(lineToAddTo == null) {
    // get current cursor position
    lineToAddTo = editor.getCursorPosition();
  }

  // check value of line
  var session = editor.session;
  if($.trim(session.getLine(lineToAddTo - 1)) == "}") {
    // remove the line with the ending curly brace
    aceRemoveLineAt(lineToAddTo);

    // add the else statement
    var lines = []

    // write else if, if there is a conditional
    if(conditional != null) {
      lines.push("} else if (" + conditional + ") {");
    } else {
      lines.push("} else {");
    }

    lines.push("// Add code here");
    lines.push("}");

    aceAddLinesAt(row, lines);
  } else {
    logDialogflowError("You can only add else statements to the end of conditional blocks. Sorry! Please try again.");
  }
}

function dialogflowRemoveLineHandler(row) {
  if(row != null) {
    aceRemoveLineAt(row);
  } else {
    logDialogflowError("You need to specify which row you would like to remove. Sorry! Please try again.");
  }
}

function dialogflowAddCommandHandler(row, commandPhrase) {
	if(commandPhrase != null){
		var lines = [];
		lines.push(commandPhrase + ";");
		aceAddLinesAt(row, lines);
	} else{
		logDialogflowError("No command phrase found.");
	}
}
		

// handles all actions returned from dialogflow
// command should be an object, with at least one property: { action: '' }
function dialogflowHandler(command) {
  switch(command.action) {
    case "CreateFile":

      var name = command.parameters.fields.filename['stringValue'];
      var type = command.parameters.fields.filetype['stringValue'];

      //make sure both values exist before creating file
      if(name != "" && type != ""){
	     // console.log("File Name: "+name);
	     // console.log("File Type: "+type);
	//create new file
	var fileName = name+"."+type;
      	dialogflowCreateFileHandler(fileName);
	setTimeout(dialogflowChangeFileHandler.bind(null, fileName), 1000);

      	//if cpp file, deploy default template
	if(type == "cpp"){
                setTimeout(dialogflowDefaultTempHandler, 1200);
	  }
      }
      break;
    
    case "MoveCursor":

	var row = command.parameters.fields.row.numberValue;
	var goToEnd = command.parameters.fields.goToEnd.stringValue;
	
	//make sure both values exist
	if(row != "" && goToEnd != ""){
	//	console.log("Row: "+row);
	//	console.log("goToEnd: "+goToEnd);
		//update goToEnd values
		if(goToEnd == "yes"){
			goToEnd = true;
		} else{
			goToEnd = false;
		}

                //move cursor
		dialogflowMoveCursorHandler(row, goToEnd);
	}
        break;


    case "DeleteFile":
      
      var name = command.parameters.fields.filename['stringValue'];
      var type = command.parameters.fields.filetype['stringValue'];

      //make sure both values exist before creating file
      if(name != "" && type != ""){
	     // console.log("File Name: "+name);
	     // console.log("File Type: "+type);
	//create new file
	var fileName = name+"."+type;
        dialogflowDeleteFileHandler(fileName);
      }
      break;

    case "ChangeFile":
      
      var name = command.parameters.fields.filename['stringValue'];
      var type = command.parameters.fields.filetype['stringValue'];

      //make sure both values exist before creating file
      if(name != "" && type != ""){
	    // console.log("File Name: "+name);
	    // console.log("File Type: "+type);
	//create new file
	var fileName = name+"."+type;
        dialogflowChangeFileHandler(fileName);
      }

      break;

    case "SaveFile":
      dialogflowSaveFileHandler();
      break;

    case "CompileFile":
      dialogflowCompileFileHandler();
      break;
/*
    case "Default":
     //creates default C++ source file
     dialogflowDefaultTempHandler();
     break;

    case "AddInclude":
      dialogflowAddInclude(command.headerName, command.localHeader);
      break
*/
    case "AddNewLine":
      
      var row = command.parameters.fields.row.stringValue;
      var newRow = command.parameters.fields.row.numberValue;
      
      if(row != ""){	
	console.log("Row: "+row);
	console.log("NewRow: "+newRow);
        dialogflowAddNewLineHandler(newRow);
      }
      break;

    case "Print":

      var content = command.parameters.fields.content.stringValue;
      console.log("Content: "+content);
      var row = null;
      dialogflowPrintHandler(row, content);
      break;

    case "AddVariable":

      var name = command.parameters.fields.name.stringValue;
      var type = command.parameters.fields.type.stringValue;
      var row = null;
      var value = command.parameters.fields.value.stringValue;

      //console.log ("Parameters: "+JSON.stringify(command.parameters.fields));
      if(name !="" && type !="" && value !=""){
	      console.log("name: "+name);
	      console.log("type: "+type);
	      console.log("value: "+value);
	      
	      switch(type){
		      case "integer":
		              console.log("In Integer Case..");
			      type = "int";
	       		      dialogflowAddVariableHandler(row, type, name, value);
			      break;

		      case "boolean":
			      console.log("In Boolean Case..");
			      type = "bool";
	                      dialogflowAddVariableHandler(row, type, name, value);
			      break;

	              case "int":
	                      dialogflowAddVariableHandler(row, type, name, value);
			      break;

	              case "bool":
	                      dialogflowAddVariableHandler(row, type, name, value);
			      break;
             
		      case "string":
	                      dialogflowAddVariableHandler(row, type, name, value);
			      break;

	              default:
    			      logDialogflowError("ERROR: Not a supported variable type.");

	      }
      }
      break;
/*
    //case "AddForLoop":
    //  dialogflowAddForLoopHandler(command.row, command.counterVar, command.startingNumber, command.conditional, command.direction, command.incrementor);
     // break;

    case "AddWhileLoop":
      dialogflowAddWhileLoopHandler(command.row, command.conditional);
      break;

    case "AddIf":
      dialogflowAddIfHandler(command.row, command.conditional);
      break;

    case "AddElse":
      dialogflowAddElseHandler(command.row, command.conditional);
      break;
*/
    case "RemoveLine":
      
      var row = command.parameters.fields.row.stringValue;
      var oldRow = command.parameters.fields.row.numberValue;
      
      if(row != ""){	
	      console.log("Row: "+row);
	      console.log("OldRow: "+newRow);
        dialogflowRemoveLineHandler(oldRow);
      }
      break;
	
    case "AddCommand":
      dialogflowAddCommandHandler(command.row, command.commandPhrase);
      break;

      default:
        logDialogflowError("Command not understood. Sorry! Please try again.");
    }

}

// setup ide after document is ready
$(document).ready(function() {
  // setup ide specific elements on ide page
  if($("#ide").length == 1) {
    createTerminal();
    createEditor();
    createNavTree();
    createChatBox();
    createVoiceRecorder();
  }
});

//get which tutorial the user wants to start and send it to dialogflow
$(document).click(function(event) {
    var text = $(event.target).text();
	switch(text)
	{
		case "Basic Tutorial":
			sendDialogFlow("hello");
			break;
		case "Advanced Tutorial":
			sendDialogFlow("start advanced tutorial");
			break;
	}
});
