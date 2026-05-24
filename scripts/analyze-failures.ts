import "dotenv/config";

import OpenAI from "openai";

import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function main() {
  const { data: failures, error } = await supabase
    .from("test_results")
    .select("*")
    .eq("status", "failed")
    .not("error_message", "is", null);

  if (error) {
    console.error(error);
    return;
  }

  for (const failure of failures || []) {
    // Avoid duplicate analysis
    const { data: existing } = await supabase
      .from("ai_analysis")
      .select("id")
      .eq("run_id", failure.run_id)
      .eq("test_name", failure.test_name)
      .maybeSingle();

    if (existing) {
      console.log(
        `Skipping already analyzed test: ${failure.test_name}`
      );
      continue;
    }

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4.1-mini",

        messages: [
          {
            role: "system",

            content:
              "You are an expert QA automation engineer.",
          },

          {
            role: "user",

            content: `
Analyze this Playwright test failure.

Test name:
${failure.test_name}

Error:
${failure.error_message}

Return ONLY valid JSON in this format:

{
  "summary": "...",
  "severity": "low|medium|high",
  "suggested_fix": "..."
}
`,
          },
        ],
      });

    const content =
      completion.choices[0].message.content || "{}";

    console.log(content);

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error(
        "Failed to parse OpenAI response:",
        e
      );

      parsed = {
        summary: content,
        severity: "medium",
        suggested_fix:
          "Unable to parse structured response.",
      };
    }

    const { error: insertError } = await supabase
      .from("ai_analysis")
      .insert({
        run_id: failure.run_id,
        test_name: failure.test_name,
        error_message: failure.error_message,

        ai_summary: parsed.summary,
        suggested_fix: parsed.suggested_fix,
        severity: parsed.severity,
      });

    if (insertError) {
      console.error(insertError);
    } else {
      console.log(
        `AI analysis saved for: ${failure.test_name}`
      );
    }
  }
}

main();