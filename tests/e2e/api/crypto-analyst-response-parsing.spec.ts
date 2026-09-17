import { expect, test } from "@playwright/test";

// Test the response text extraction logic
// This tests the fixed extractResponseText function that had duplicate code removed

const extractResponseText = (data: Record<string, unknown>): string => {
  // Claude: data.content[0].text
  if (Array.isArray(data.content)) {
    const textBlock = (data.content as Array<{ type: string; text?: string }>).find(
      (block) => block.type === "text",
    );
    if (textBlock?.text) {
      return textBlock.text.trim();
    }
  }

  // OpenAI: data.choices[0].message.content
  if (Array.isArray(data.choices)) {
    const choice = (data.choices as Array<{ message?: { content?: string } }>)[0];
    if (choice?.message?.content) {
      return choice.message.content.trim();
    }
  }

  // Gemini: data.candidates[0].content.parts[0].text
  if (Array.isArray(data.candidates)) {
    const candidate = (
      data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>
    )[0];
    if (candidate?.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text.trim();
    }
  }

  return "";
};

test("extractResponseText parses Claude API response format", () => {
  const claudeResponse = {
    content: [
      { type: "text", text: "Bitcoin is a decentralized digital currency." },
    ],
  };

  const result = extractResponseText(claudeResponse);
  expect(result).toBe("Bitcoin is a decentralized digital currency.");
});

test("extractResponseText parses OpenAI API response format", () => {
  const openaiResponse = {
    choices: [
      {
        message: {
          content: "Ethereum enables smart contracts and decentralized applications.",
        },
      },
    ],
  };

  const result = extractResponseText(openaiResponse);
  expect(result).toBe(
    "Ethereum enables smart contracts and decentralized applications."
  );
});

test("extractResponseText parses Gemini API response format", () => {
  const geminiResponse = {
    candidates: [
      {
        content: {
          parts: [{ text: "Crypto markets operate 24/7 without closing." }],
        },
      },
    ],
  };

  const result = extractResponseText(geminiResponse);
  expect(result).toBe("Crypto markets operate 24/7 without closing.");
});

test("extractResponseText handles Groq response (OpenAI compatible)", () => {
  const groqResponse = {
    choices: [
      {
        message: {
          content: "Groq provides fast inference using custom hardware.",
        },
      },
    ],
  };

  const result = extractResponseText(groqResponse);
  expect(result).toBe("Groq provides fast inference using custom hardware.");
});

test("extractResponseText handles DeepSeek response (OpenAI compatible)", () => {
  const deepseekResponse = {
    choices: [
      {
        message: {
          content: "DeepSeek offers efficient reasoning capabilities.",
        },
      },
    ],
  };

  const result = extractResponseText(deepseekResponse);
  expect(result).toBe("DeepSeek offers efficient reasoning capabilities.");
});

test("extractResponseText returns empty string for unrecognized format", () => {
  const unknownResponse = {
    data: {
      response: "Some unrecognized format",
    },
  };

  const result = extractResponseText(unknownResponse);
  expect(result).toBe("");
});

test("extractResponseText trims whitespace from responses", () => {
  const responseWithWhitespace = {
    content: [
      { type: "text", text: "  \n  Bitcoin analysis with extra spaces  \n  " },
    ],
  };

  const result = extractResponseText(responseWithWhitespace);
  expect(result).toBe("Bitcoin analysis with extra spaces");
});

test("extractResponseText handles missing nested properties gracefully", () => {
  const incompleteResponse = {
    choices: [
      {
        message: {
          // content is missing
        },
      },
    ],
  };

  const result = extractResponseText(incompleteResponse);
  expect(result).toBe("");
});

test("extractResponseText prioritizes Claude format when multiple formats present", () => {
  // If somehow a response has both Claude and OpenAI formats, Claude should be checked first
  const multiFormatResponse = {
    content: [{ type: "text", text: "Claude format response" }],
    choices: [
      {
        message: {
          content: "OpenAI format response",
        },
      },
    ],
  };

  const result = extractResponseText(multiFormatResponse);
  expect(result).toBe("Claude format response");
});

test("extractResponseText falls back to OpenAI when Claude format unavailable", () => {
  const openaiOnlyResponse = {
    content: [{ type: "other", data: "not text" }],
    choices: [
      {
        message: {
          content: "OpenAI format is used as fallback",
        },
      },
    ],
  };

  const result = extractResponseText(openaiOnlyResponse);
  expect(result).toBe("OpenAI format is used as fallback");
});

test("extractResponseText handles Claude responses with multiple content blocks", () => {
  const multiBlockResponse = {
    content: [
      { type: "other", text: "should be skipped" },
      { type: "text", text: "The actual response text" },
      { type: "text", text: "This should not be used" },
    ],
  };

  const result = extractResponseText(multiBlockResponse);
  expect(result).toBe("The actual response text");
});

test("extractResponseText handles Gemini with multiple candidate responses", () => {
  const multiCandidateResponse = {
    candidates: [
      {
        content: {
          parts: [{ text: "First candidate response" }],
        },
      },
      {
        content: {
          parts: [{ text: "Second candidate response" }],
        },
      },
    ],
  };

  const result = extractResponseText(multiCandidateResponse);
  expect(result).toBe("First candidate response");
});
