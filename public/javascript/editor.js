$(document).ready(function() {
  // only setup editor on page with editor element
  if($("#editor").length == 1) {
    createEditor();
  }
  // only setup nave tree on ide page
  if($("#terminal").length == 1) {
    createNavTree();
  }
});

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

function createNavTree() {
  // retrieve user workspace folder name
  $tree = $("#tree");
  var namespace = $tree.data("namespace");

  console.log(namespace);

  // using default options
  $tree.fancytree({
	  source: {
		  url: "/" + namespace + "/tree/data.json",
		  cache: false
	  },
	  //TODO add functionality for clicked files to load into text editor
	  activate: function(event, data) {
		  // A node was activated: display its title:
		  var node = data.node;
      $("#echoActive").text(node.title)

      // read and display selected file
      fileName = node.title;
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
