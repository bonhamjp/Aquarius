//set up express
const express = require('express'),
    app = express(),
    ws = require('express-ws')(app),
    handlebars = require('express-handlebars').create({ defaultLayout: 'main' }),
    bodyParser = require('body-parser'),
    passport = require('passport'),
    auth = require('./auth'),
    cookieParser = require('cookie-parser'),
    cookieSession = require('cookie-session'),
    pty = require('node-pty'),
    keys = require('./keys');
	  fs = require('fs'),
	  path = require('path')
    fileIO = require('./file-io');

// set up handlebars
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// set up bodyParser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// serve public assets
app.use(express.static('public'));
app.use(express.static('node_modules/xterm/dist'));

// set up OAuth
auth(passport);

//function to read file structure
function dirTree(filename, key) {
    var stats = fs.lstatSync(filename),
        //json object containing file structure
        info = {
            path: filename,
            title: path.basename(filename),
			key: key
        };

    if (stats.isDirectory()) {
        info.folder = true;
		info.lazy = true; //FancyTree param to only expand node when clicked
        info.children = fs.readdirSync(filename).map(function(child) {
            return dirTree(filename + '/' + child, key + 1);
        });

		//sort children putting directories on top
		info.children.sort( function(a,b) {

        if (a.folder === true && b.folder === false) return -1;
        if (b.folder === true && a.folder === false) return 1;

        return a.path.localeCompare(b.path);
		});
    }

	else {
        info.folder = false;
    }

    return info;

// session validator helper
function authorizedEmail(emailAddr) {
  return emailAddr.match(/oregonstate.edu/);
}

// web socket for terminal
app.ws("/", function(ws, req) {
  var term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 128,
    rows: 48,
    cwd: process.env.PWD,
    env: process.env
  });

  var pid = term.pid;
  console.log('Created terminal. PID: %d', pid);

  term.on('data', function(data) {
    try {
      // send response from terminal to the frontend
      ws.send(data);
    } catch (e) {
      // print out error
      console.log(e);
    }
  });

  ws.on('message', function(message) {
    // send message to terminal
    term.write(message);
  });

  ws.on('close', function () {
    process.kill(pid);
    console.log('Closed terminal');
  });
});

//set up passport
app.use(passport.initialize());
app.use(passport.session());

//set up cookies
app.use(cookieSession({
    name: 'session',
    keys: ['123'] //still need to look into this more and possibly make it more secure
}));

app.use(cookieParser());

//landing page
app.get('/', (req,res) => {

   if(req.session.token){
        //get file structure and write to file
        var info = {}
	    info = dirTree('.', 1); //we can pass in any file or direcotry we want; could be used to control file access
	    fs.writeFile("./public/getTreeData.json", JSON.stringify(info), function(err){
		if(err){return console.log(err);}
			console.log("File write complete");
	    });

        res.cookie('token', req.session.token);

        var context = {};
        var emailAddr = req.session.passport.user.profile.emails[0].value;
        if(authorizedEmail(emailAddr)) {
            context.display_name = req.session.passport.user.profile.displayName;
            context.email = emailAddr;
            context.aquarius_domain = keys.aquarius.domain;
            context.aquarius_port = keys.aquarius.port;

            res.render('ide', context);
        }
        else{
            context.message = "Only users with Oregon State credentials can access VIDE. Sorry.";
            res.render('sign-in', context);
        }
    }
    else{
        res.cookie('token', '')
        res.redirect('/sign-in');
    }
});

// read file
app.get('/read/:fileName', (req, res) => {
  if(req.session.token) {
    res.cookie('token', req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var fileOutput = fileIO.readFile(fileName, req.session.passport.user.profile.id);
    }

    // send back plain text
    res.send(fileOutput);
  } else {
    // could not load session
    res.send('');
  }
});

// write file
app.post('/write/:fileName', (req, res) => {
  if(req.session.token) {
    res.cookie('token', req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var fileContent = req.body['content'];

      // write file to user namespace
      fileIO.writeFile(fileName, fileContent, req.session.passport.user.profile.id);
    }

    // send back plain text
    res.send('Success');
  } else {
    // could not load session
    res.send('Failure!');
  }
});

//sign in
app.get('/sign-in', function(req, res) {
    res.render('sign-in');
});

//logout
app.get('/logout', (req, res) => {
    req.logout();
    req.session = null;
    res.redirect('/');
});

//verification of user
app.get('/auth/google', passport.authenticate('google', {
    scope: ['https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile']
}));

//callback after verification
app.get('/auth/google/callback',
    passport.authenticate('google',{failureRedirect: '/sign-in'}),
    (req, res) => {
        req.session.token = req.user.token;
        res.redirect('/');
    }
);

// use port specified in command, if it exists
var port = parseInt(process.argv.slice(2)) || 3000;

// start server
// UPDATE: Need to create 'server' variable to export Express server to test files
const server = app.listen(port, function() {
  console.log('Express started on port ' + port + '; press Ctrl-C to terminate.');
});

module.exports = server;
