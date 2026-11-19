const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => null);
  if (!body || !["legal", "divination"].includes(body.page_id)) {
    return json({ error: "Invalid page_id" }, 400);
  }
  if (JSON.stringify(body).length > 30000) return json({ error: "Request too large" }, 413);

  const apiKey = Deno.env.get("VISION_API_KEY");
  const baseUrl = (Deno.env.get("VISION_API_BASE_URL") || "https://xjjuhe.site/v1").replace(/\/+$/, "");
  const model = Deno.env.get("VISION_MODEL") || "gpt-6.1-sol";
  if (!apiKey) return json({ error: "Model service is not configured" }, 503);

  const legal = body.page_id === "legal";
  const instruction = legal
    ? "你是中文法律咨询材料整理助手。根据用户问题整理事实、证据清单、风险和下一步建议，不编造法律条文，不将内容表述为律师结论。"
    : "你是中文国学文化解读助手。根据问题和签文提供文化解读、现实行动建议和节奏提醒。不得宣称确定性预测，不提供投资、医疗等专业决策。";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${instruction} 只返回 JSON，所有文本使用简体中文。字段：summary（非空字符串）、recommendations、risk_notes、focus、evidence_checklist、timing_notes（均为字符串数组）。` },
          { role: "user", content: JSON.stringify({ issue: body.issue, question: body.question, fortune: body.fortune, action_id: body.action_id, context: body.context }) },
        ],
      }),
    });
    if (!response.ok) return json({ error: "模型服务暂时不可用，请稍后重试。" }, 502);
    const payload = await response.json();
    const analysis = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
    if (typeof analysis.summary !== "string" || !analysis.summary.trim()) {
      return json({ error: "模型返回内容不完整，请重试。" }, 502);
    }
    const list = (name: string) => Array.isArray(analysis[name])
      ? analysis[name].filter((value: unknown) => typeof value === "string").slice(0, 6) : [];
    return json({
      id: crypto.randomUUID(),
      type: `${body.page_id}_ai_analysis`,
      provider_status: "live",
      model,
      generated_at: new Date().toISOString(),
      action_id: body.action_id,
      summary: analysis.summary,
      recommendations: list("recommendations"),
      risk_notes: list("risk_notes"),
      focus: list("focus"),
      evidence_checklist: list("evidence_checklist"),
      timing_notes: list("timing_notes"),
      disclaimer: legal ? "内容仅供咨询准备参考，具体法律意见请咨询执业律师。" : "内容仅作文化参考与娱乐，不构成事实预测或专业建议。",
    });
  } catch {
    return json({ error: "分析服务暂时不可用，请稍后重试。" }, 502);
  }
});
