/** Body returned by `GET` and `PUT /conflicts/{id}/perspective`. */
export type Perspective = {
  summary: string | null;
  partnerView: string | null;
  feelings: string | null;
  approvedAt: string | null;
  feelingsSharedAt: string | null;
};

/** Body returned by `POST /conflicts/{id}/perspective/summary/generate`. */
export type SummaryResponse = {
  summary: string;
};

/** Body returned by `POST /conflicts/{id}/perspective/partner-view/generate`. */
export type PartnerViewResponse = {
  partnerView: string;
};

/** Body returned by `POST /conflicts/{id}/perspective/approve`. */
export type ApproveResponse = {
  approvedAt: string;
  conflictStatus: "collecting" | "feedback";
};

/** Body returned by `GET /conflicts/{id}/partner-perspective`. */
export type PartnerPerspectiveUnavailable = {
  available: false;
};

export type PartnerPerspectiveAvailable = {
  available: true;
  partnerView: string;
  approvedAt: string;
  feelings: string | null;
  feelingsSharedAt: string | null;
};

export type PartnerPerspective =
  | PartnerPerspectiveUnavailable
  | PartnerPerspectiveAvailable;

/** Body returned by `POST /conflicts/{id}/perspective/feelings`. */
export type ShareFeelingsResponse = {
  feelings: string;
  feelingsSharedAt: string;
};
