// IMPORTANT:
//   set these values to the host, and port of the machine it is being run on
var AQUARIUS_DOMAIN_NAME = 'localhost';
var AQUARIUS_PORT = '3000';

$(document).ready(function() {
  // only setup terminal on page with terminal element
  if($('#terminal').length == 1) {
    createTerminal();
  }
});

function createTerminal() {
  // apply fit addon, so that size of terminal can be fitted to container
  Terminal.applyAddon(fit);

  // create terminal object
  var term = new Terminal();

  // open xterm
  term.open(document.getElementById('terminal'));

  // set xterm display properties
  term.setOption('fontFamily', 'monospace');
  term.setOption('fontSize', '14');

  // fit the terminal to dimensions of container
  term.fit();

  // sets up websocket
  var socketURL = 'ws://' + AQUARIUS_DOMAIN_NAME + ':' + AQUARIUS_PORT + '/';
  var socket = new WebSocket(socketURL);

  socket.onopen = function() {
    // write response to xterm console, when received
    socket.addEventListener('message', function(res) {
      // write response from server to console
      term.write(res.data);
    });

    // handle xterm intput
    term.on('data', function(data) {
      // send user input to server, for terminal to execute
      socket.send(data);
    });
  }

  $(window).resize(function() {
    // re-fit the terminal to dimensions of container
    term.fit();
  });
}
