import { requireAuth } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/handler";
import { jsonResponse } from "@/lib/api/json";
import {
  createConflict,
  listConflicts,
} from "@/lib/services/conflict.service";
import { parseCreateConflictRequest } from "@/lib/validators/conflict.validators";

export const POST = withErrorHandling(async (request) => {
  const { userId, coupleId } = await requireAuth(request);
  const input = await parseCreateConflictRequest(request);
  const conflict = await createConflict(coupleId, userId, input);

  return jsonResponse(conflict, 201);
});

export const GET = withErrorHandling(async (request) => {
  const { coupleId } = await requireAuth(request);
  const conflicts = await listConflicts(coupleId);

  return jsonResponse(conflicts);
});
