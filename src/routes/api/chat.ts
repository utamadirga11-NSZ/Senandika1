import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { SENANDIKA_SYSTEM_PROMPT } from "@/lib/ai/system-prompt.server";
import { ageGuidance } from "@/lib/ai/age-guidance.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id.server";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(z.any()).min(1).max(400),
});

const json = (status: number, error: string) => Response.json({ error }, { status });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!token) return json(401, "Silakan masuk dulu.");
        const url = process.env['SUPABASE_URL']!;
        const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
        if (authErr || !claims?.claims?.sub) return json(401, "Sesi tidak valid. Silakan masuk lagi.");

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, "Permintaan tidak valid.");
        const { threadId } = parsed.data;
        const messages = parsed.data.messages as UIMessage[];

        const { data: thread } = await supabase.from("threads").select("id,title").eq("id", threadId).maybeSingle();
        if (!thread) return json(404, "Percakapan tidak ditemukan.");

        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          const { error } = await supabase.from("messages").upsert(
            { thread_id: threadId, message_id: last.id, role: "user", parts: last.parts as unknown as Json },
            { onConflict: "thread_id,message_id", ignoreDuplicates: true },
          );
          if (error) console.error("save user message failed", error);
          const firstText = last.parts.find((p) => p.type === "text");
          const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
          if (thread.title === "Percakapan baru" && firstText && "text" in firstText) {
            patch.title = firstText.text.slice(0, 60);
          }
          await supabase.from("threads").update(patch).eq("id", threadId);
        }

        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!apiKey) return json(500, "Layanan AI belum dikonfigurasi.");
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const { data: profile } = await supabase
          .from("profiles")
          .select("age")
          .eq("user_id", claims.claims.sub)
          .maybeSingle();

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          system: SENANDIKA_SYSTEM_PROMPT + ageGuidance(profile?.age),
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          generateMessageId: () => crypto.randomUUID(),
          sendReasoning: false,
          onError: (e) => {
            console.error("chat error", e);
            const status = (e as { statusCode?: number })?.statusCode;
            if (status === 429) return "Sedang ramai. Coba lagi sebentar lagi.";
            if (status === 402) return "Kredit AI habis. Tambahkan kredit di pengaturan workspace.";
            return "Maaf, ada gangguan. Coba kirim lagi.";
          },
          onFinish: async ({ responseMessage }) => {
            const hasText = responseMessage.parts.some((p) => p.type === "text" && p.text.trim());
            if (!responseMessage.id || !hasText) return;
            const { error } = await supabase.from("messages").upsert(
              {
                thread_id: threadId,
                message_id: responseMessage.id,
                role: "assistant",
                parts: responseMessage.parts as unknown as Json,
              },
              { onConflict: "thread_id,message_id" },
            );
            if (error) console.error("save assistant message failed", error);
          },
        });
        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
