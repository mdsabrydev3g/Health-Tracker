import { getSession } from "@/core/auth/session";
import { json } from "@/server/api-helpers";

export async function GET() {
  const session = await getSession();
  return json({ email: session?.email ?? null });
}
