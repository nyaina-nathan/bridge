import { authResponse } from "@/lib/api/auth-response";
import { withErrorHandling } from "@/lib/api/handler";
import { register } from "@/lib/services/auth.service";
import { parseRegisterRequest } from "@/lib/validators/auth.validators";

export const POST = withErrorHandling(async (request) => {
  const input = await parseRegisterRequest(request);
  const { session, tokens } = await register(input);

  return authResponse(session, tokens, 201);
});
