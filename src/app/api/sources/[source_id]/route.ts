import { toResponse } from "@/server/http";
import { getSource } from "@/server/sources";

export async function GET(
  _request: Request,
  context: { params: Promise<{ source_id: string }> },
): Promise<Response> {
  const { source_id } = await context.params;
  return toResponse(getSource(source_id));
}
