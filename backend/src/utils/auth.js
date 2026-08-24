import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'adeeb_session';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  return secret;
}

export function signSession(user, remember = false) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret(), { expiresIn: remember ? '365d' : '1d', issuer: 'adeeb-cash-flow' });
}

export function verifySession(token) {
  return jwt.verify(token, jwtSecret(), { issuer: 'adeeb-cash-flow' });
}

export function setSessionCookie(res, token, remember = false) {
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  };
  if (remember) options.maxAge = 365 * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, token, options);
}

export function clearSessionCookie(res) {
 res.clearCookie(COOKIE_NAME, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/'
});
}

export { COOKIE_NAME };
