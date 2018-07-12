//set up express
const express = require('express'),
    app = express(),
    passport = require('passport'),
    auth = require('./auth'),
    cookieParser = require('cookie-parser'),
    cookieSession = require('cookie-session');

var session = require('express-session');
var handlebars = require('express-handlebars').create({ defaultLayout: 'main' });

var bodyParser = require('body-parser');

// set up handlebars
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

// set up bodyParser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// serve public assets
app.use(express.static('public'));

auth(passport);

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
        res.cookie('token', req.session.token);
        var user = {};
        user.name = req.session.passport.user.profile.displayName;
        res.render('ide', user);
    }
    else{
        res.cookie('token', '')
        res.redirect('/sign-in');
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
    scope: ['https://www.googleapis.com/auth/userinfo.profile']
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
app.listen(port, function() {
  console.log('Express started on port ' + port + '; press Ctrl-C to terminate.');
});
