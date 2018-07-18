$(document).ready(function() {
  // only setup editor on page with editor element
  if($('#editor').length == 1) {
    createEditor();
  }
});

function createEditor() {
  // initialize ace editor
  var editor = ace.edit('editor');

  // set editor theme
  editor.setTheme('ace/theme/monokai');

  // set syntax highlighting
  editor.getSession().setMode('ace/mode/c_cpp');

  // TODO: set it up to read other files
  readFile(editor);

  // set save button listener
  $(document).on('click', '#save-file', function() {
    // TODO: set it up to write to other files
    writeFile(editor);
  });
}

// asynchronous file reader
function readFile(editor) {
  $.ajax({
    url: '/read/main.cpp'
  }).done(function(data) {
    // write contents of file to editor
    editor.setValue(data);
  });
}

// asynchronous file write
function writeFile(editor) {
  $.ajax({
    type: 'POST',
    url: '/write/main.cpp',
    data: { content: editor.getValue() }
  }).done(function(data) {
    // TODO: display success status somewher
  });
}
