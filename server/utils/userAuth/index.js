const { admin } = require('../../config/firebase');
const { APIError, FirebaseAuthError } = require('../exception');
const UserSession = require('./session');

const UserAuth = {
  /**
   * @description Authenticates a user and returns the uid
   * @function
   * @async
   *
   * @param {String} jwt JSON Web Token
   * @param {admin.Auth} _auth Firebase Authentication Library
   * @returns {Object | GraphQLError} decodedToken
   */
  authenticate: async (jwt, _auth = admin?.auth()) => {
    try {
      const _decodedToken =
        process.env.NODE_ENV === 'development' && process.env.FIREBASE_TEST_AUTH_KEY === jwt
          ? {
              uid: '',
              exp: 4102444800, // Jan 1, 2100 at midnight
              mid: process.env.MID,
              roles: ['user.superadmin', 'article.admin', 'issue.admin', 'tag.admin', 'live.superadmin', 'media.admin'],
              email_verified: true,
            }
          : await _auth.verifyIdToken(jwt, true);
      if (!_decodedToken.email_verified) {
        throw APIError('UNAUTHORIZED', null, {
          reason: "The User's Email ID is not verified.",
        });
      }
      return _decodedToken;
    } catch (error) {
      throw FirebaseAuthError(error);
    }
  },

  /**
   * @description Parses the auth status
   * @function
   *
   * @param {String} jwt
   * @returns {NULL | Object | GraphQLError}
   */
  getContext: async (req, _auth = admin?.auth()) => {
    try {
      if (!req || !req.headers || !req.headers.authorization) {
        return { authToken: null, decodedToken: null, mid: null };
      }

      const jwt = decodeURI(req.headers.authorization);
      if (!jwt) {
        return { authToken: null, decodedToken: null, mid: null };
      }

      if (UserSession.valid(req.session, jwt)) {
        return {
          authToken: req.session.auth.jwt,
          decodedToken: req.session.auth.decodedToken,
          mid: req.session.auth.mid,
        };
      }

      const _decodedToken = await UserAuth.authenticate(jwt, _auth);

      if (!_decodedToken) {
        return { authToken: req.headers.authorization, decodedToken: null, mid: null };
      }

      const { uid, exp, roles, mid } = _decodedToken;

      if (req.session) {
        req.session.auth = {
          uid,
          mid,
          jwt: req.headers.authorization,
          exp,
          roles,
          decodedToken: _decodedToken,
        };
        await req.session.save();
      }

      return {
        authToken: req.headers.authorization,
        decodedToken: _decodedToken,
        mid: _decodedToken.mid,
      };
    } catch (error) {
      throw APIError(null, error, { reason: "The server could not retrieve a user's auth scope." });
    }
  },
};

module.exports = UserAuth;
