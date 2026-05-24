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
Test failed:

${failure.test_name}

Error:

${failure.error_message}

Analyze:
1. Root cause
2. Severity
3. Suggested fix
`,
          },
        ],
      });

    console.log(
      completion.choices[0].message.content
    );
  }
}

main();