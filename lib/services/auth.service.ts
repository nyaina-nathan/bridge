import { createHash, randomBytes, randomInt } from "node:crypto";

import bcrypt from "bcrypt";

import { ApiError } from "../api/errors";
import { assertJwtConfigured, signAccessToken } from "../auth/jwt";
import { prisma } from "../db/prisma";
import type { AuthResult, AuthSession, RefreshResult } from "../types/auth.types";
import type { LoginInput, RegisterInput } from "../validators/auth.validators";

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Rotate the refresh token once this little of its 30-day lifetime remains. */
const REFRESH_ROTATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_MAX_ATTEMPTS = 5;

/** Prisma include used by both auth flows to build the public session body. */
const userWithCoupleInclude = {
  couples: {
    include: {
      users: {
        select: {
          id: true,
          display_name: true,
        },
        orderBy: {
          created_at: "asc" as const,
        },
      },
    },
  },
};

type UserWithCouple = {
  id: string;
  display_name: string;
  email: string;
  couples: {
    id: string;
    invite_code: string;
    users: Array<{
      id: string;
      display_name: string;
    }>;
  } | null;
};

type RefreshTokenData = {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
};

function generateInviteCode(): string {
  let code = "";

  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }

  return code;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRefreshTokenData(): RefreshTokenData {
  const rawToken = randomBytes(32).toString("base64url");

  return {
    rawToken,
    tokenHash: hashRefreshToken(rawToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

function toAuthSession(user: UserWithCouple): AuthSession {
  const couple = user.couples;

  if (!couple) {
    throw new Error(`User ${user.id} does not belong to a couple`);
  }

  return {
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
    },
    couple: {
      id: couple.id,
      inviteCode: couple.invite_code,
      members: couple.users.map((member) => ({
        id: member.id,
        displayName: member.display_name,
      })),
    },
  };
}

async function buildAuthResult(
  user: UserWithCouple,
  refresh: RefreshTokenData,
): Promise<AuthResult> {
  const session = toAuthSession(user);
  const accessToken = await signAccessToken(user.id, session.couple.id);

  return {
    session,
    tokens: {
      accessToken,
      refreshToken: refresh.rawToken,
    },
  };
}

function getPrismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function uniqueViolationTargets(error: unknown): string[] {
  if (typeof error !== "object" || error === null || !("meta" in error)) {
    return [];
  }

  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;

  if (Array.isArray(target)) {
    return target.map(String);
  }

  return typeof target === "string" ? [target] : [];
}

function isUniqueViolation(error: unknown, field: string): boolean {
  return (
    getPrismaErrorCode(error) === "P2002" &&
    uniqueViolationTargets(error).some((target) => target.includes(field))
  );
}

async function registerWithInvite(
  input: RegisterInput,
  inviteCode: string,
  passwordHash: string,
): Promise<AuthResult> {
  const couple = await prisma.couples.findUnique({
    where: {
      invite_code: inviteCode,
    },
    select: {
      id: true,
      _count: {
        select: {
          users: true,
        },
      },
    },
  });

  if (!couple) {
    throw ApiError.notFound("INVALID_INVITE_CODE");
  }

  if (couple._count.users >= 2) {
    throw ApiError.conflict("COUPLE_FULL");
  }

  const refresh = createRefreshTokenData();

  try {
    const user = await prisma.$transaction(async (tx) => {
      // Serialize concurrent joins on the same couple, then re-check the limit.
      const lockedCouple = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM couples
        WHERE id = ${couple.id}::uuid
        FOR UPDATE
      `;

      if (lockedCouple.length === 0) {
        throw ApiError.notFound("INVALID_INVITE_CODE");
      }

      const memberCount = await tx.users.count({
        where: {
          couple_id: couple.id,
        },
      });

      if (memberCount >= 2) {
        throw ApiError.conflict("COUPLE_FULL");
      }

      const created = await tx.users.create({
        data: {
          couple_id: couple.id,
          display_name: input.displayName,
          email: input.email,
          password_hash: passwordHash,
        },
        include: userWithCoupleInclude,
      });

      await tx.refresh_tokens.create({
        data: {
          user_id: created.id,
          token_hash: refresh.tokenHash,
          expires_at: refresh.expiresAt,
        },
      });

      return created;
    });

    return buildAuthResult(user, refresh);
  } catch (error) {
    if (getPrismaErrorCode(error) === "P2002") {
      if (isUniqueViolation(error, "email")) {
        throw ApiError.conflict("EMAIL_TAKEN");
      }

      const emailTaken = await prisma.users.findUnique({
        where: {
          email: input.email,
        },
        select: {
          id: true,
        },
      });

      if (emailTaken) {
        throw ApiError.conflict("EMAIL_TAKEN");
      }
    }

    throw error;
  }
}

async function registerWithNewCouple(
  input: RegisterInput,
  passwordHash: string,
): Promise<AuthResult> {
  for (
    let attempt = 0;
    attempt < INVITE_CODE_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const inviteCode = generateInviteCode();
    const refresh = createRefreshTokenData();

    try {
      const user = await prisma.$transaction(async (tx) => {
        const couple = await tx.couples.create({
          data: {
            invite_code: inviteCode,
          },
        });

        const created = await tx.users.create({
          data: {
            couple_id: couple.id,
            display_name: input.displayName,
            email: input.email,
            password_hash: passwordHash,
          },
          include: userWithCoupleInclude,
        });

        await tx.refresh_tokens.create({
          data: {
            user_id: created.id,
            token_hash: refresh.tokenHash,
            expires_at: refresh.expiresAt,
          },
        });

        return created;
      });

      return buildAuthResult(user, refresh);
    } catch (error) {
      if (getPrismaErrorCode(error) !== "P2002") {
        throw error;
      }

      if (isUniqueViolation(error, "email")) {
        throw ApiError.conflict("EMAIL_TAKEN");
      }

      if (isUniqueViolation(error, "invite_code")) {
        continue;
      }

      // Some drivers omit the constraint target. Decide by checking the email.
      const emailTaken = await prisma.users.findUnique({
        where: {
          email: input.email,
        },
        select: {
          id: true,
        },
      });

      if (emailTaken) {
        throw ApiError.conflict("EMAIL_TAKEN");
      }
    }
  }

  throw new Error("Could not generate a unique invite code");
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  assertJwtConfigured();

  const existingUser = await prisma.users.findUnique({
    where: {
      email: input.email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw ApiError.conflict("EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const inviteCode = input.inviteCode;

  if (inviteCode) {
    return registerWithInvite(input, inviteCode, passwordHash);
  }

  return registerWithNewCouple(input, passwordHash);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  assertJwtConfigured();

  const user = await prisma.users.findUnique({
    where: {
      email: input.email,
    },
    include: userWithCoupleInclude,
  });

  if (!user) {
    // Keep unknown-email requests as expensive as wrong-password requests.
    await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    throw ApiError.invalidCredentials();
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw ApiError.invalidCredentials();
  }

  if (!user.couples) {
    throw new Error(`User ${user.id} does not belong to a couple`);
  }

  const refresh = createRefreshTokenData();

  await prisma.refresh_tokens.create({
    data: {
      user_id: user.id,
      token_hash: refresh.tokenHash,
      expires_at: refresh.expiresAt,
    },
  });

  return buildAuthResult(user, refresh);
}

/**
 * Issues a new access token from a refresh token. The refresh token is rotated
 * only when less than 24 hours of its 30-day lifetime remain. Presenting an
 * already-revoked token revokes every active token for that user.
 */
export async function refresh(rawToken?: string): Promise<RefreshResult> {
  assertJwtConfigured();

  if (!rawToken) {
    throw ApiError.invalidRefreshToken();
  }

  const token = await prisma.refresh_tokens.findUnique({
    where: {
      token_hash: hashRefreshToken(rawToken),
    },
    select: {
      id: true,
      user_id: true,
      expires_at: true,
      revoked_at: true,
      users: {
        select: {
          couple_id: true,
        },
      },
    },
  });

  if (!token) {
    throw ApiError.invalidRefreshToken();
  }

  if (token.revoked_at) {
    await prisma.refresh_tokens.updateMany({
      where: {
        user_id: token.user_id,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    throw ApiError.invalidRefreshToken();
  }

  const now = Date.now();

  if (token.expires_at.getTime() <= now) {
    throw ApiError.invalidRefreshToken();
  }

  const coupleId = token.users.couple_id;

  if (!coupleId) {
    throw ApiError.invalidRefreshToken();
  }

  const accessToken = await signAccessToken(token.user_id, coupleId);
  const shouldRotate =
    token.expires_at.getTime() - now < REFRESH_ROTATION_THRESHOLD_MS;

  if (!shouldRotate) {
    return { accessToken };
  }

  const next = createRefreshTokenData();

  const rotated = await prisma.$transaction(async (tx) => {
    // Only one concurrent refresh may revoke this row and issue a successor.
    const revoked = await tx.refresh_tokens.updateMany({
      where: {
        id: token.id,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });

    if (revoked.count === 0) {
      return false;
    }

    await tx.refresh_tokens.create({
      data: {
        user_id: token.user_id,
        token_hash: next.tokenHash,
        expires_at: next.expiresAt,
      },
    });

    return true;
  });

  if (!rotated) {
    throw ApiError.invalidRefreshToken();
  }

  return {
    accessToken,
    refreshToken: next.rawToken,
  };
}

/**
 * Loads the authenticated user's current session. The database is the source
 * of truth, so a token for a deleted account resolves to `401`.
 */
export async function getSession(userId: string): Promise<AuthSession> {
  const user = await prisma.users.findUnique({
    where: {
      id: userId,
    },
    include: userWithCoupleInclude,
  });

  if (!user || !user.couples) {
    throw ApiError.unauthorized();
  }

  return toAuthSession(user);
}

/**
 * Revokes the refresh token supplied by the caller. Missing or already-revoked
 * tokens are a no-op so logout stays idempotent.
 */
export async function logout(
  userId: string,
  refreshToken?: string,
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  await prisma.refresh_tokens.updateMany({
    where: {
      user_id: userId,
      token_hash: hashRefreshToken(refreshToken),
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });
}
