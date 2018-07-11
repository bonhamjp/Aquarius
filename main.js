var express = require('express');
var session = require('express-session');
var handlebars = require('express-handlebars').create({ defaultLayout: 'main' });

var bodyParser = require('body-parser');

// set up express app
var app = express();

// set up handlebars
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// set up bodyParser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// serve public assets
app.use(express.static('public'));

// OAuth login
app.get('/sign-in', function(req, res) {
  res.render('sign-in');
});

// TODO: support for setting up session using OAuth

// destroy session
app.get('/sign-out', function(req, res) {
  req.session.destroy();

  res.redirect('/sign-in');
});

// IDE entrypoint
app.get('/', function(req, res) {
  // TODO: prevent user from accessing main page unless session setup through OAuth

  res.render('ide');
});

// use port specified in command, if it exists
var port = parseInt(process.argv.slice(2)) || 3000;

// start server
// UPDATE: Need to create 'server' variable to export Express server to test files
const server = app.listen(port, function() {
  console.log('Express started on port ' + port + '; press Ctrl-C to terminate.');
});

module.exports = server;
