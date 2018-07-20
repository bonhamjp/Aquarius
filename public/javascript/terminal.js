$(document).ready(function() {
  // only setup terminal on ide page
  if($("#terminal").length == 1) {
    createTerminal();
  }
});

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
  var socket = new WebSocket(socketURL);

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
  }

  $(window).resize(function() {
    // re-fit the terminal to dimensions of container
    term.fit();
  });
}

function createEditor() {
  // initialize ace editor
  var editor = ace.edit("editor");

  // set editor theme
  editor.setTheme("ace/theme/monokai");

  // set syntax highlighting
  editor.getSession().setMode("ace/mode/c_cpp");
}
