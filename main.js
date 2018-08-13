//set up express
const express = require("express"),
  app = express(),
  ws = require("express-ws")(app),
  handlebars = require("express-handlebars").create({ defaultLayout: "main" }),
  bodyParser = require("body-parser"),
  passport = require("passport"),
  auth = require("./auth"),
  cookieParser = require("cookie-parser"),
  cookieSession = require("cookie-session"),
  pty = require("node-pty"),
  dialogflow = require('dialogflow'),
  path = require('path');
  keys = require("./keys"),
  dirTree = require("./dir-tree"),
  fileIO = require("./file-io"),
	ffmpeg = require('ffmpeg'),
	speech = require('@google-cloud/speech'),
	fs = require('fs');

// set up handlebars
app.engine("handlebars", handlebars.engine);
app.set("view engine", "handlebars");

// set up bodyParser
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));
app.use(bodyParser.json());

// serve public assets
app.use(express.static("public"));
app.use(express.static("workspaces"));
app.use(express.static("node_modules/xterm/dist"));

// set up OAuth
auth(passport);

// session validator helper
function authorizedEmail(emailAddr) {
  return emailAddr.match(/oregonstate.edu/);
}

// web socket for terminal
app.ws("/", function(ws, req) {
  var term = pty.spawn("bash", [], {
    name: "xterm-color",
    cols: 128,
    rows: 48,
    cwd: process.env.PWD,
    env: process.env
  });

  var pid = term.pid;
  console.log("Created terminal. PID: %d", pid);

  term.on("data", function(data) {
    try {
      // send response from terminal to the frontend
      ws.send(data);
    } catch (e) {
      // print out error
      console.log(e);
    }
  });

  ws.on("message", function(message) {
    // send message to terminal
    term.write(message);
  });

  ws.on("close", function () {
    process.kill(pid);
    console.log("Closed terminal");
  });
});

//set up passport
app.use(passport.initialize());
app.use(passport.session());

//set up cookies
app.use(cookieSession({
    name: "session",
    keys: ["123"] //still need to look into this more and possibly make it more secure
}));

app.use(cookieParser());

// voice api
// Creates a client
const client = new speech.SpeechClient();

//landing page
app.get("/", (req,res) => {
  var context = {};
  if(req.session.token) {
    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      // TODO: allow customizable projects
      var namespace = req.session.passport.user.profile.id;
      var project = emailAddr;
      var profilePic = req.session.passport.user.profile._json.image.url;

      // TODO: remove after demonstration
      // build directory, if it does not exist
      fileIO.buildProject(namespace, project);
      // create two empty c++ project files, if project empty
      fileIO.buildFile(namespace, project, "main.cpp");
      fileIO.buildFile(namespace, project, "main.h");

      // // use user workspace/project directory as base for dir tree
      // var treeOutput = dirTree.buildTreeData("./workspaces/" + namespace + "/" + project, 1);
      // fileIO.writeFile("data.json", JSON.stringify(treeOutput), namespace, "tree");

      // set cookie
      res.cookie("token", req.session.token);

      // display data
      context.display_name = req.session.passport.user.profile.displayName;
      context.email = emailAddr;
      context.aquarius_domain = keys.aquarius.domain;
      context.aquarius_port = keys.aquarius.port;
      context.root_path = path.resolve(__dirname);
      context.namespace = namespace;
      context.project = project;
      context.profilePic = profilePic;

      res.render("ide", context);
    } else {
      context.message = "Only users with Oregon State credentials can access VIDE. Sorry.";
      res.render("sign-in", context);
    }
  } else {
    context.message = "You must log in with an Oregon State email address to use VIDE.";
    res.render("sign-in", context);
  }
});

// syncs nav tree
app.post("/syncNavTree", (req, res) => {
  var context = {};
  if(req.session.token) {
    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      // use user workspace/project directory as base for dir tree
      var namespace = req.session.passport.user.profile.id;
      var project = emailAddr;

      var treeOutput = dirTree.buildTreeData("./workspaces/" + namespace + "/" + project, 1);
      fileIO.writeFile("data.json", JSON.stringify(treeOutput), namespace, "tree");

      // directory structure saved
      res.send("Success");
    }
  }
});

// read file
app.get("/read/:fileName/:folder", (req, res) => {
  if(req.session.token) {
    res.cookie("token", req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;

      // read file from namespace
      var fileOutput = fileIO.readFile(fileName, req.session.passport.user.profile.id, folder);
    }

    // send back plain text
    res.send(fileOutput);
  } else {
    // could not load session
    res.send("");
  }
});

// write file
app.post("/write/:fileName/:folder", (req, res) => {
  if(req.session.token) {
    res.cookie("token", req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;
      var fileContent = req.body["content"];

      // write file to user namespace
      fileIO.writeFile(fileName, fileContent, req.session.passport.user.profile.id, folder);
    }

    // send back plain text
    res.send("Success");
  } else {
    // could not load session
    res.send("Failure!");
  }
});

// write file
app.post("/writeflac/:fileName/:folder", (req, res) => {
  if(req.session.token) {
    res.cookie("token", req.session.token);
    var emailAddr = req.session.passport.user.profile.emails[0].value;

    if(authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;
      var fileContent = req.body["content"];

      // write flac file in namespace, then get response from google translate
      fileIO.writeFlacFileWithHandler(fileName, fileContent, req.session.passport.user.profile.id, folder, function() {
        // The name of the audio file to transcribe
        const fileName = './workspaces/'+ req.session.passport.user.profile.id + '/voice/recording.flac';

        //Reads a local audio file and converts it to base64
        const file = fs.readFileSync(fileName);
        const audioBytes = file.toString('base64');

        // The audio file's encoding, sample rate in hertz, and BCP-47 language code
        const audio = {
          content: audioBytes,
        };
        const config = {
          languageCode: 'en-US'
        };
        const request = {
          audio: audio,
          config: config,
        };

        // Detects speech from the audio file
        client
          .recognize(request)
          .then(data => {
            const response = data[0];
            const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');

            res.send(transcription);
          })
          .catch(err => {
            console.error('ERROR:', err);
          });
      });
    }
  } else {
    // could not load session
    res.send("Failure!");
  }
});

// write file
app.post("/append/:fileName/:folder", (req, res) => {
  if(req.session.token) {
    res.cookie("token", req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if(authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;
      var fileContent = req.body["content"];

      // write file to user namespace
      fileIO.appendFile(fileName, fileContent, req.session.passport.user.profile.id, folder);
    }

    // send back plain text
    res.send("Success");
  } else {
    // could not load session
    res.send("Failure!");
  }
});

//sign in
app.get("/sign-in", function(req, res) {
    res.render('sign-in');
});

//logout
app.get("/logout", (req, res) => {
    req.logout();
    req.session = null;
    res.redirect('/');
});

//verification of user
app.get("/auth/google", passport.authenticate("google", {
    scope: ['https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile']
}));

//callback after verification
app.get("/auth/google/callback",
    passport.authenticate("google", {failureRedirect: "/sign-in"}),
    (req, res) => {
        req.session.token = req.user.token;
        res.redirect("/");
    }
);

function isEmptyObject(obj){
	return !Object.keys(obj).length;
}

//word to symbol mapper for conditional statements
function getConditional(strConditional)
{
	if(strConditional.includes("is less than or equal to"))
	{
		var match = strConditional.match(/is less than or equal to/g);
		
		var conditional = strConditional.replace(match[0], " <= ");
	}
	
	else if(strConditional.includes("less than or equal to"))
	{
		var match = strConditional.match(/less than or equal to/g);
		
		var conditional = strConditional.replace(match[0], " <= ");
	}
	
	else if(strConditional.includes("is less than"))
	{
		match = strConditional.match(/is less than/g);
		
		var conditional = strConditional.replace(match[0], " < ");
		
	}
	
	else if(strConditional.includes("less than"))
	{
		match = strConditional.match(/less than/g);
		
		var conditional = strConditional.replace(match[0], " < ");
	}
	
	else if(strConditional.includes("is greater than or equal to"))
	{
		match = strConditional.match(/is greater than or equal to/g);
		var conditional = strConditional.replace(match[0], " >= ");
	}
	
	else if(strConditional.includes("greater than or equal to"))
	{
		match = strConditional.match(/greater than or equal to/g);
		var conditional = strConditional.replace(match[0], " >= ");
	}
	
	else if(strConditional.includes("is greater than"))
	{
		match = strConditional.match(/is greater than/g);
		
		var conditional = strConditional.replace(match[0], " > ");
	
	}
	
	else if(strConditional.includes("greater than"))
	{
		match = strConditional.match(/greater than/g);
		
		var conditional = strConditional.replace(match[0], " > ");
	
	}
	
	else if(strConditional.includes("is equal to"))
	{
		match = strConditional.match(/is equal to/g);
		
		var conditional = strConditional.replace(match[0], " == ");
	}
	
	else if(strConditional.includes("equal to"))
	{
		match = strConditional.match(/equal to/g);
		
		var conditional = strConditional.replace(match[0], " == ");
	}
	
	return conditional;
}

//sends text to dialogflow
app.post("/sendToDialogflow", function(req, res){
	//create variables
	const projectId = 'final-176901';
	const sessionId = '123';
	const query = req.body["content"];
	const languageCode = 'en-US';

	//Instantiate a Dialogflow client
	const sessionClient = new dialogflow.SessionsClient();

	//Define session path
	const sessionPath = sessionClient.sessionPath(projectId, sessionId);

	//create dialogflow request
	const request = {
		session: sessionPath,
		queryInput: {
			text: {
				text: query,
				languageCode: languageCode,
			},
		},
	};

	//send request and log result
	sessionClient
	  .detectIntent(request)
	  .then(responses => {
      
      //only for debuggin dialogflow responses		  
      console.log('Detected Intent');
      const result = responses[0].queryResult;
      if(result.intent){
        console.log(` Intent: ${result.intent.displayName}`);
       } else {
         console.log(`No intent matched.`);
        }
      console.log(` Action: ${result.action}`);
      console.log("Parameters: "+JSON.stringify(result.parameters));
      res.send(result);
     });
/*
          console.log(` Intent: ${result.intent.displayName}`);
        } else {
         console.log(`No intent matched.`);
	   }
      console.log(` Action: ${result.action}`);
		  switch(result.action)
		  {
			  case "Help":
			  {
				  res.send(result);
				  break;
			  }
			  
			  case "AddVariable":
			  {
				  var name = result.parameters.fields.name.stringValue;
				  var type = result.parameters.fields.type.stringValue;
				  if(!isEmptyObject(name) && !isEmptyObject(type))
				  {
					var handler = {};
					handler.action = result.action; 
					handler.name = name;
					handler.type = type;
					console.log(handler);
					res.send(handler);
				  }
				  
				  else
				  {
					res.send(result);
				  }
				  
				  break;
			  }
			  
			  case "CreateFile":
			  {
					var name = result.parameters.fields.filename.stringValue;
					var type = result.parameters.fields.filetype.stringValue;
					if(!isEmptyObject(name) && !isEmptyObject(type))
					{
						var handler = {};
						handler.action = result.action;
						handler.filename = name + "." + type;
						console.log(handler)
						res.send(handler);
					}
					
					else
					{
						res.send(result);
					}
					
					break;
			  }
			  
			  case "AddWhileLoop":
			  {
				    var strConditional = result.parameters.fields.conditional.stringValue;
			
					if(!isEmptyObject(strConditional))
					{
						var handler = {};
						
						var conditional = getConditional(strConditional);
						
						handler.action = result.action;
						handler.conditional = conditional;
						console.log(handler);
						res.send(handler);
					}
					
					else
					{
						res.send(result);
					}
					
					break;
			  }
			
			  case "AddIf":
			  {
				  var strConditional = result.parameters.fields.conditional.stringValue;
			
					if(!isEmptyObject(strConditional))
					{
						var handler = {};
						
						var conditional = getConditional(strConditional);
						
						handler.action = result.action;
						handler.conditional = conditional;
						console.log(handler);
						res.send(handler);
					}
					
					else
					{
						res.send(result);
					}
					
					break;
			  }
			  
			  case "Print":
			  {
				  var strContent = result.parameters.fields.content.stringValue;
				  if(!isEmptyObject(strContent))
				  {
					  var handler = {};
					  var content
					  
					  if(strContent.includes("print"))
					  {
						  match = strContent.match(/print/g);
						  
						  content = strContent.replace(match[0], "");
					  }
					  
					  else
					  {
						  content = strContent;
					  }
					  
					  handler.action = result.action;
					  handler.content = content;
					  console.log(handler);
					  res.send(handler);
				  }
				  
				  else
				  {
					  res.send(result);
				  }
				  
				  break;
			  }
			  
			  case "DeleteFile":
			  {
					var name = result.parameters.fields.filename.stringValue;
					var type = result.parameters.fields.filetype.stringValue;
					if(!isEmptyObject(name) && !isEmptyObject(type))
					{
						var handler = {};
						handler.action = result.action;
						handler.filename = name + "." + type;
						console.log(handler)
						res.send(handler);
					}
					
					else
					{
						res.send(result);
					}
					
					break;
			  }
			  
			  case "ChangeFile":
			  {
					var name = result.parameters.fields.filename.stringValue;
					var type = result.parameters.fields.filetype.stringValue;
					if(!isEmptyObject(name) && !isEmptyObject(type))
					{
						var handler = {};
						handler.action = result.action;
						handler.filename = name + "." + type;
						console.log(handler)
						res.send(handler);
					}
					
					else
					{
						res.send(result);
					}
					
					break;
			  }
			  
			  case "SaveFile":
			  {
				  var handler = {};
				  handler.action = result.action;
				  res.send(handler);
			  }
			  
			  case "CompileFile":
			  {
				  var handler = {};
				  handler.action = result.action;
				  res.send(handler);	
			  }
			  
			  case "AddInclude":
			  {
				  var headerName = result.parameters.fields.headerName.stringValue;
				  var localHeader = result.parameters.fields.localHeader.stringValue;
				  if(!isEmptyObject(headerName) && !isEmptyObject(localHeader))
				  {
					var handler = {};
					var local;
					if(localHeader == "yes")
					{
						local = true;
					}
					
					else
					{
						local = false;
					}
					
					handler.action = result.action;
					handler.headerName = headerName;
					handler.localHeader = local;
					
					res.send(handler);
				  }
				  
				  else
				  {
					  res.send(result);
				  }
				  
				  break;
			  }
			  
			  case "MoveCursor":
			  {
				  
				  var row = result.parameters.fields.row;
				  var goToEnd = result.parameters.fields.goToEnd.stringValue;
				  if(!isEmptyObject(row) && !isEmptyObject(goToEnd))
				  {
					  row = result.parameters.fields.row.numberValue;
					var handler = {};
					var end;
					if(goToEnd == "yes")
					{
						end = true;
					}
					
					else
					{
						end = false;
					}
					
					handler.action = result.action;
					handler.row = row;
					handler.goToEnd = end;
					res.send(handler);
				  }
				  
				  else
				  {
					  res.send(result);
				  }
				  
				  break;
			  }
			  
			  case "AddNewLine":
			  {
				  
				  var row = result.parameters.fields.row;
	
				  if(!isEmptyObject(row))
				  {
					row = result.parameters.fields.row.numberValue;
					var handler = {};
				
					handler.action = result.action;
					handler.row = row;
					res.send(handler);
				  }
				  
				  else
				  {
					 res.send(result);
				  }
				  
				  break;
			  }
			  
			  case "RemoveLine":
			  {
				  
				  var row = result.parameters.fields.row;
	
				  if(!isEmptyObject(row))
				  {
					row = result.parameters.fields.row.numberValue;
					var handler = {};
				
					handler.action = result.action;
					handler.row = row;
					res.send(handler);
				  }
				  
				  else
				  {
					 res.send(result);
				  }
				  
				  break;
			  }
			  
			  case "AddForLoop":
			  {
				  var counterVar = result.parameters.fields.countingVar.stringValue;
				  var strConditional = result.parameters.fields.conditional.stringValue;
				  var direction = result.parameters.fields.direction.stringValue;
				  var incrementor = result.parameters.fields.incrementor.stingValue;
				  var startingNumber = result.parameters.fields.startingNumber;
				  
				  console.log(JSON.stringify(result.parameters));
				  
				  if(!isEmptyObject(counterVar) && !isEmptyObject(strConditional) && !isEmptyObject(direction) && !isEmptyObject(incrementor) && !isEmptyObject(startingNumber))
					 {
						 var handler = {};
						 
						 startingNumber = result.parameters.fields.startingNumber.numberValue;
						 
						 if(direction == "increase")
						 {
							 direction = "+";
						 }
						 
						 else
						 {
							 direction = "-";
						 }
						 
						 conditional = getConditional(strConditional);
						 
						 handler.action = result.action;
						 handler.counterVar = counterVar;
						 handler.conditional = conditional;
						 handler.direction = direction;
						 handler.incrementor = incrementor;
						 handler.startingNumber = startingNumber;
						 console.log(handler);
						 res.send(handler);
					 }
					 
					else
					{
						res.send(result);
					}
					
					break;
					
			  }
			  
			  default:
			  {
				  res.send(result);
			  }
						 
		  }
	  })
    .catch(err => {
      console.error('ERROR: ', err);
    });
*/
});
/*
function dialogParser(action, result){
	
	var handler = {};
	
	switch(action)
	{
		case "AddVariable":
			var name = result.parameters.fields.name.stringValue;
			var type = result.parameters.fields.type.stringValue;
			//var dfAction = action;
			handler.action = action;
			handler.type = type;
			handler.name = name;
			return handler;
			break;
	}
}
*/	

// use port specified in command, if it exists
var port = parseInt(process.argv.slice(2)) || 3000;

// start server
// UPDATE: Need to create 'server' variable to export Express server to test files
const server = app.listen(port, function() {
  console.log("Express started on port " + port + "; press Ctrl-C to terminate.");
});

module.exports = server;
