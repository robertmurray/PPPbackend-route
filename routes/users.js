const passport = require( 'passport' );
const bcrypt = require( 'bcrypt-as-promised' );
const express = require( 'express' );
const jwt = require( 'jsonwebtoken' );
const knex = require( '../knex' );
const bodyParser = require( 'body-parser' );
const {
    camelizeKeys,
    decamelizeKeys
} = require( 'humps' );
const {
    middlewareVerify
} = require( '../middlewares/verifications.js' );
const router = express.Router();
// router.post('/users/login', middlewareVerify);
// router.post('/user/signup', middlewareVerify);

require( '../config/passport' )( passport );

passport.serializeUser( ( user, done ) => {
    done( null, user );
} );
passport.deserializeUser( ( obj, done ) => {
    done( null, obj );
} );

// See all user information
router.get( '/user', ( req, res, next ) => {
    return knex( 'users' ).select( 'id', 'first_name', 'last_name', 'email' ).then( ( users ) => {
        res.json( users );
    } ).catch( ( err ) => {
        console.log( err );
    } );
} );

// User can log into their account.
router.post( '/user/login', ( req, res, next ) => {
    const {
        email,
        password
    } = req.body;

    // comment
    if ( !email || !email.trim() ) {
        return res.status( 400 ).send( 'Email must not be blank' );
    }

    // comment
    if ( !password || !password.trim() ) {
        return res.status( 400 ).send( 'password must not be blank' );
    }

    let authUser;

    // comment
    knex( 'users' ).where( 'email', email ).first().then( ( user ) => {
        if ( !user ) {
            return res.status( 400 ).send( 'Bad email ! Boom!' );
        }

        authUser = camelizeKeys( user );
        return bcrypt.compare( req.body.password, authUser.hashedPassword )
    } ).then( ( match ) => {
        if ( match === false ) {
            return res.status( 400 ).send( 'Invalid username or password' );
        }
        const claim = {
            userId: authUser.id
        };
        const token = jwt.sign( claim, process.env.JWT_KEY, {
            expiresIn: '7 days'
        } );
        res.cookie( 'token', token, {
            httpOnly: true,
            expires: new Date( Date.now() + 1000 * 60 * 60 * 24 * 7 ),
            secure: router.get( 'env' ) === 'production'
        } );
        // comment
        delete authUser.hashedPassword;
        delete authUser.createdAt;
        delete authUser.updatedAt;
        authUser.token = token;
        res.send( authUser );
    } ).catch( ( err ) => {
        next( err );
    } );
} );

// User can sign up for a new account with our database.
router.post( '/user/signup', ( req, res, next ) => {
    if ( req.body.email === undefined ) {
        // comment here about what happens in the if case.
        res.set( 'Content-type', 'text/plain' );
        res.status( 400 )
            .send( 'Email must not be blank' );
    } else if ( req.body.password === undefined || req.body.password.length < 8 ) {
        // comment here about what happens in the else if case.
        res.set( 'Content-type', 'text/plain' );
        return res.status( 400 )
            .send( 'Password must be at least 8 characters long' );
    } else {
        // comment here about what happens in the else case.
        knex( 'users' ).where( 'email', req.body.email ).first().then( ( user ) => {
                if ( user ) {
                    res.set( 'Content-type', 'text/plain' );
                    res.status( 400 ).send( 'Email already exist!' );
                }
                return bcrypt.hash( req.body.password, 12 );
            } )
            .then( ( hashedPassword ) => {
                const newUser = {
                    first_name: req.body.firstName,
                    last_name: req.body.lastName,
                    email: req.body.email,
                    hashed_password: hashedPassword
                }
                return knex( 'users' ).insert( ( newUser ), '*' );
            } )
            .then( ( insertedUser ) => {
                const camelizedUser = camelizeKeys( insertedUser[ 0 ] );
                const claim = {
                    userId: camelizedUser.id
                };
                const token = jwt.sign( claim, process.env.JWT_KEY, {
                    expiresIn: '7 days'
                } );

                res.cookie( 'token', token, {
                    httpOnly: true,
                    expires: new Date( Date.now() + 1000 * 60 * 60 * 24 * 7 ), // 7 days
                    secure: router.get( 'env' ) === 'production'
                } );

                delete camelizedUser.hashedPassword;
                delete camelizedUser.createdAt;
                delete camelizedUser.updatedAt;
                res.set( 'Content-type', 'application/json' );
                res.status( 200 ).send( camelizedUser );

            } )
            .catch( ( error ) => {
                res.status( 400 ).send( 'Invalid Input' );
            } );
    }
} );

// you could move these two to an auth router or an auth/google router.
//localhost:8000/auth/google
router.get( '/auth/google', passport.authenticate( 'google', {
    scope: [ 'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile' ]
} ) );

router.get( '/auth/google/callback', passport.authenticate( 'google' ), ( req, res ) => {
    console.log( 'what is google res', res );
    return res.send( req.session.passport.user )
} );

module.exports = router;
