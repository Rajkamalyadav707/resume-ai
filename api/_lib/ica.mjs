const DEFAULT_URL = "https://api.servicesessentials.ibm.com/v1";

export function config() {
  const apiKey = process.env.ICA_API_KEY;
  const baseUrl = (process.env.ICA_API_URL || DEFAULT_URL).replace(/\/+$/, "");
  const model = process.env.ICA_MODEL || "claude-haiku-4-5";
  if (!apiKey)
    throw Object.assign(new Error("AI service is not configured."), {
      statusCode: 503,
    });
  return {
    apiKey,
    baseUrl,
    model,
    analysisModel: process.env.ICA_ANALYSIS_MODEL || model,
    optimizeModel: process.env.ICA_OPTIMIZE_MODEL || model,
    chatModel: process.env.ICA_CHAT_MODEL || model,
  };
}

export function json(response, status, body) {
  response
    .status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8");
  return response.send(body);
}

export function requirePost(request, response) {
  if (request.method !== "POST") {
    json(response, 405, { error: "Method not allowed." });
    return false;
  }
  return true;
}

export function text(value, limit) {
  return typeof value === "string" && value.trim() && value.length <= limit
    ? value.trim()
    : null;
}

export async function complete(messages, maxTokens = 4000, task = "default") {
  const settings = config();
  const { apiKey, baseUrl } = settings;
  const model =
    task === "analysis"
      ? settings.analysisModel
      : task === "optimization"
        ? settings.optimizeModel
        : task === "chat"
          ? settings.chatModel
          : settings.model;
  const result = await fetch(`${baseUrl}/chat-models/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });
  const raw = await result.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }
  if (!result.ok)
    throw Object.assign(
      new Error(
        data.detail ||
          data.error?.message ||
          "AI service is temporarily unavailable.",
      ),
      { statusCode: 502 },
    );
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string")
    throw Object.assign(new Error("AI service returned an invalid response."), {
      statusCode: 502,
    });
  return content;
}

export function parseJson(content) {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start)
    throw Object.assign(
      new Error("AI returned an invalid structured response."),
      { statusCode: 502 },
    );
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw Object.assign(
      new Error("AI returned an invalid structured response."),
      { statusCode: 502 },
    );
  }
}
