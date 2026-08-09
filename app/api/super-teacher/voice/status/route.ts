import { sofiaVoiceReleaseStatus } from "@/lib/super-teacher/voice-release";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(sofiaVoiceReleaseStatus(), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Sufeiya-Voice-Mode": "disabled",
    },
  });
}
