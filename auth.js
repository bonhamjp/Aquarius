//set up strategy
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

//create export
module.exports = function (passport) {
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });
    
    //TODO implement client ID and secret for each server
    passport.use(new GoogleStrategy({
        //client ID and secret for Kyle's server
        clientID:"163229689204-jllnkm3ig1hhj9jvsq9j69engir5bvbu.apps.googleusercontent.com",
        clientSecret: "gB3ZpwkeM3PNqiwP5kjVAlE3",
        callbackURL: '/auth/google/callback'
        },
        (token, refreshToken, profile, done) => {
            return done(null, {
                profile: profile,
                token: token
            });
        }));
    };
