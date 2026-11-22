import { readJsonBody, toResponse } from "@/server/http";
import { createReviewTask } from "@/server/review-tasks/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return toResponse(await createReviewTask(await readJsonBody(request)));
}
