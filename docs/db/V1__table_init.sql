-- Active: 1793448977537@@127.0.0.1@5432@bridge
-- Couple conflict mediator: minimal MVP schema (PostgreSQL 13+)
-- Core loop only: explain -> reframe for partner -> feelings.
-- Solutions / conclusion tracking are at the bottom, commented out for v2.

-- A couple is just a container with an invite code for the partner.
CREATE TABLE couples (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_code TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Max 2 users per couple (enforce in app code for the MVP).
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id     UUID REFERENCES couples(id),
    display_name  TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh tokens (opaque random string sent in an HttpOnly cookie).
-- Only the SHA-256 hash is stored, never the raw token.
-- Rotation: every refresh revokes the old row and inserts a new one.
-- If a revoked token is presented again, revoke all of that user's tokens.
-- The access JWT is stateless and is NOT stored.
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- One disagreement. "status" follows the flow; "outcome" is step 5, filled at the end.
CREATE TABLE conflicts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id  UUID NOT NULL REFERENCES couples(id),
    created_by UUID NOT NULL REFERENCES users(id),
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'collecting'
               CHECK (status IN ('collecting', 'feedback', 'closed')),
               -- collecting: each person writes/approves their side (steps 1-2)
               -- feedback  : both approved, partners read each other + share feelings (step 3)
               -- closed    : outcome set (step 5)
    outcome    TEXT CHECK (outcome IN ('resolved', 'later', 'unsolvable')),
    flagged    BOOLEAN NOT NULL DEFAULT false,  -- set if safety signals are detected
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at  TIMESTAMPTZ
);

-- Each person's PRIVATE chat with the AI about this conflict (step 1).
-- Never shown to the partner.
CREATE TABLE messages (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),  -- whose private thread
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_thread ON messages (conflict_id, user_id, created_at);

-- What actually gets shared (the consent gate), one row per person per conflict.
--   summary      : the person's version of the story (AI draft, editable by them)
--   partner_view : that version reframed for the partner (step 2)
--   feelings     : how they feel about the situation (step 3)
--   approved_at  : set when the author approves partner_view.
--                  The partner can only see partner_view once this is set.
--   feelings_shared_at : set when the author submits feelings.
--                  The partner can only see feelings once this is set.
CREATE TABLE perspectives (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id  UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    summary      TEXT,
    partner_view TEXT,
    feelings     TEXT,
    approved_at  TIMESTAMPTZ,
    feelings_shared_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conflict_id, user_id)
);

-- ---------------------------------------------------------------
-- v2 (step 4 and follow-ups), add when the core loop works:
--
-- CREATE TABLE solutions (
--     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     conflict_id UUID NOT NULL REFERENCES conflicts(id) ON DELETE CASCADE,
--     content     TEXT NOT NULL,
--     proposed_by TEXT NOT NULL,  -- 'ai' or a user id
--     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
--
-- CREATE TABLE solution_votes (
--     solution_id UUID NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
--     user_id     UUID NOT NULL REFERENCES users(id),
--     accepted    BOOLEAN NOT NULL,
--     PRIMARY KEY (solution_id, user_id)
-- );
--
-- Later: check-in reminders for outcome = 'later', pattern tracking across conflicts.
-- ---------------------------------------------------------------