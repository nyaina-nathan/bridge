import { authResponse } from "@/lib/api/auth-response";
import { withErrorHandling } from "@/lib/api/handler";
import { login } from "@/lib/services/auth.service";
import { parseLoginRequest } from "@/lib/validators/auth.validators";

export const POST = withErrorHandling(async (request) => {
  const input = await parseLoginRequest(request);
  const { session, tokens } = await login(input);

  return authResponse(session, tokens, 200);
});
