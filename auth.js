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
        clientID:[secret],
        clientSecret: [secret],
        callbackURL: '/auth/google/callback'
        },
        (token, refreshToken, profile, done) => {
            return done(null, {
                profile: profile,
                token: token
            });
        }));
    };
