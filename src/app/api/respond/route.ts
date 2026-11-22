import { readJsonBody, toResponse } from "@/server/http";
import { respond } from "@/server/respond";

export async function POST(request: Request): Promise<Response> {
  return toResponse(respond(await readJsonBody(request)));
}
