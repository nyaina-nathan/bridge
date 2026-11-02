export type ConflictStatus = "collecting" | "feedback" | "closed";

export type ConflictOutcome = "resolved" | "later" | "unsolvable";

/** Body returned by `POST /conflicts` and `POST /conflicts/{id}/close`. */
export type Conflict = {
  id: string;
  title: string;
  status: ConflictStatus;
  outcome: ConflictOutcome | null;
  flagged: boolean;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
};

/** One row in `GET /conflicts`. */
export type ConflictListItem = {
  id: string;
  title: string;
  status: ConflictStatus;
  outcome: ConflictOutcome | null;
  createdAt: string;
  closedAt: string | null;
};

export type ConflictList = {
  items: ConflictListItem[];
};

/** Non-private progress summary for one person. */
export type PerspectiveProgress = {
  hasSummary: boolean;
  approved: boolean;
  feelingsShared: boolean;
};

export type ConflictProgress = {
  me: PerspectiveProgress;
  partner: PerspectiveProgress;
};

/** Body returned by `GET /conflicts/{id}`. */
export type ConflictDetail = Conflict & {
  progress: ConflictProgress;
};
