/** Public user shape returned by the auth endpoints. */
export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
};

/** A member listed inside a couple. */
export type AuthCoupleMember = {
  id: string;
  displayName: string;
};

/** Public couple shape returned by the auth endpoints. */
export type AuthCouple = {
  id: string;
  inviteCode: string;
  members: AuthCoupleMember[];
};

/** Body returned by register and login (`AuthSession` in the OpenAPI spec). */
export type AuthSession = {
  user: AuthUser;
  couple: AuthCouple;
};

/** Raw token values that the route helper writes to cookies. */
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/** Authenticated caller extracted from the access token cookie. */
export type AuthContext = {
  userId: string;
  coupleId: string;
};

/** Tokens returned by a refresh. The refresh token is only present on rotation. */
export type RefreshResult = {
  accessToken: string;
  refreshToken?: string;
};

/** What the auth service returns to the route handlers. */
export type AuthResult = {
  session: AuthSession;
  tokens: AuthTokens;
};
