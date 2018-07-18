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

  // retrieve domain and port, in order to set up web socket
  $terminal = $('#terminal');
  var aquarius_domain = $terminal.data('aquarius-domain');
  var aquarius_port = $terminal.data('aquarius-port');

  // sets up websocket
  var socketURL = 'ws://' + aquarius_domain + ':' + aquarius_port + '/';
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

$(function(){
  // using default options
  $("#tree").fancytree({
	  source: {
		  url: "/getTreeData.json",
		  cache: false
	  },
	  //TODO add functionality for clicked files to load into text editor
	  activate: function(event, data){
		  // A node was activated: display its title:
		  var node = data.node;
		  $("#echoActive").text(node.title)
		},
		beforeSelect: function(event, data){
		  // A node is about to be selected: prevent this, for folder-nodes:
		  if( data.node.isFolder() ){
			return false;
		  }
		}
	});
})

function createEditor() {
  // initialize ace editor
  var editor = ace.edit("editor");

  // set editor theme
  editor.setTheme("ace/theme/monokai");

  // set syntax highlighting
  editor.getSession().setMode("ace/mode/c_cpp");
}
