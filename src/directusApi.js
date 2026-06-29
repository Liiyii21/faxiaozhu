const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL ?? "").replace(/\/$/, "");
const USE_DIRECTUS = import.meta.env.VITE_USE_DIRECTUS === "true";
const REMOTE_DIRECTUS_ENABLED = Boolean(DIRECTUS_URL && USE_DIRECTUS);
const RUNTIME_SUPABASE_CONFIG = globalThis.window?.__SUPABASE_CONFIG__ ?? {};
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? RUNTIME_SUPABASE_CONFIG.url ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? RUNTIME_SUPABASE_CONFIG.anonKey ?? "";
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const SUPABASE_AUTH_URL = `${SUPABASE_URL}/auth/v1`;
const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1`;
const REMOTE_BACKEND_ENABLED = REMOTE_DIRECTUS_ENABLED || SUPABASE_ENABLED;
const SESSION_KEY = "ai_service_directus_session";
const LOCAL_ACCOUNTS_KEY = "ai_service_local_accounts";
const LOCAL_ITEMS_KEY = "ai_service_local_items";
const LOCAL_FILES_KEY = "ai_service_local_files";

export const isLocalMode = !REMOTE_BACKEND_ENABLED;

export const directusConfig = {
  url: REMOTE_DIRECTUS_ENABLED ? DIRECTUS_URL : SUPABASE_ENABLED ? SUPABASE_URL : "local-browser-mode",
  isConfigured: true,
  isLocalMode,
  provider: SUPABASE_ENABLED ? "supabase" : REMOTE_DIRECTUS_ENABLED ? "directus" : "local",
};

const leadCollections = {
  legal: {
    lawyer: "legal_consultations",
    booking: "legal_bookings",
    detail: "legal_cases",
  },
  beauty: {
    report: "beauty_reports",
    advisor: "beauty_advisor_requests",
    scan: "beauty_scan_results",
  },
  divination: {
    consult: "divination_consults",
    share: "divination_shares",
    spin: "divination_reports",
  },
};

const defaultListLimit = 20;

function requireDirectusUrl() {
  if (!REMOTE_DIRECTUS_ENABLED) {
    throw new Error("Backend is not configured for Directus mode.");
  }
}

function readError(payload, fallback) {
  return payload?.errors?.[0]?.message ?? payload?.error?.message ?? fallback;
}

async function directusRequest(path, { method = "GET", body, token } = {}) {
  requireDirectusUrl();
  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, "Directus request failed."));
  }
  return payload?.data ?? payload;
}

async function supabaseRequest(path, { method = "GET", body, token, prefer } = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || "Supabase request failed.";
    throw new Error(message);
  }
  return payload;
}

function supabaseSessionFor(payload) {
  if (!payload?.access_token) return null;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires: payload.expires_at ? payload.expires_at * 1000 : Date.now() + Number(payload.expires_in || 3600) * 1000,
    provider: "supabase",
    user: payload.user
      ? {
          id: payload.user.id,
          email: payload.user.email,
          first_name: payload.user.user_metadata?.first_name || payload.user.email?.split("@")[0],
        }
      : undefined,
  };
}

function shapeSupabaseUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    first_name: user.user_metadata?.first_name || user.email?.split("@")[0],
    date_created: user.created_at,
  };
}

async function getSupabaseUser(session = getStoredSession()) {
  if (!SUPABASE_ENABLED) return null;
  if (session?.user?.id) return session.user;
  if (!session?.access_token) return null;
  return supabaseRequest("/auth/v1/user", { token: session.access_token });
}

function shapeSupabaseRecord(row) {
  const payload = row.payload || {};
  return {
    id: row.id,
    collection: row.collection,
    ...payload,
    status: row.status || payload.status,
    source_page: row.source_page,
    action_id: row.action_id,
    context: row.context,
    user_created: row.user_id,
    date_created: row.created_at,
    date_updated: row.updated_at,
    submitted_at: row.created_at,
  };
}

async function supabaseRegisterUser({ email, password, firstName }) {
  await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: {
      email,
      password,
      data: {
        first_name: firstName || email?.split("@")[0],
      },
    },
  });
}

async function supabaseLoginUser({ email, password }) {
  const payload = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  return storeSession(supabaseSessionFor(payload));
}

async function supabaseRefreshStoredSession(session = getStoredSession()) {
  if (!session?.refresh_token) return null;
  const payload = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: session.refresh_token },
  });
  return storeSession(supabaseSessionFor(payload));
}

async function supabaseLogout(session = getStoredSession()) {
  if (session?.access_token) {
    await supabaseRequest("/auth/v1/logout", {
      method: "POST",
      token: session.access_token,
    }).catch(() => null);
  }
  storeSession(null);
}

async function supabaseCreateRecord({ collection, values, pageId, actionId, context, session }) {
  const user = await getSupabaseUser(session);
  if (!user?.id) throw new Error("请先登录后再提交。");
  const [row] = await supabaseRequest("/rest/v1/service_records?select=*", {
    method: "POST",
    token: session.access_token,
    prefer: "return=representation",
    body: {
      user_id: user.id,
      collection,
      source_page: pageId,
      action_id: actionId,
      status: values.status || "new",
      payload: values,
      context,
    },
  });
  return shapeSupabaseRecord(row);
}

async function supabaseListRecords({ pageId, session, limit }) {
  const user = await getSupabaseUser(session);
  if (!user?.id) throw new Error("请先登录后再读取服务记录。");
  const collections = getPageCollections(pageId).join(",");
  const query = new URLSearchParams({
    select: "*",
    user_id: `eq.${user.id}`,
    source_page: `eq.${pageId}`,
    collection: `in.(${collections})`,
    order: "updated_at.desc",
    limit: String(limit),
  });
  const rows = await supabaseRequest(`/rest/v1/service_records?${query.toString()}`, {
    token: session.access_token,
  });
  return (rows ?? []).map(shapeSupabaseRecord);
}

async function supabaseReadRecord({ collection, id, session }) {
  const user = await getSupabaseUser(session);
  const query = new URLSearchParams({
    select: "*",
    id: `eq.${id}`,
    collection: `eq.${collection}`,
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`/rest/v1/service_records?${query.toString()}`, {
    token: session.access_token,
  });
  if (!rows?.[0]) throw new Error("没有找到这条记录。");
  return shapeSupabaseRecord(rows[0]);
}

async function supabaseUpdateRecord({ collection, id, values, session }) {
  const current = await supabaseReadRecord({ collection, id, session });
  const nextPayload = { ...current, ...values };
  const query = new URLSearchParams({
    id: `eq.${id}`,
    collection: `eq.${collection}`,
    select: "*",
  });
  const [row] = await supabaseRequest(`/rest/v1/service_records?${query.toString()}`, {
    method: "PATCH",
    token: session.access_token,
    prefer: "return=representation",
    body: {
      payload: nextPayload,
      status: values.status || current.status,
      updated_at: new Date().toISOString(),
    },
  });
  return shapeSupabaseRecord(row);
}

async function supabaseUploadFile({ file, metadata, session }) {
  const user = await getSupabaseUser(session);
  if (!user?.id) throw new Error("请先登录后再上传文件。");
  if (!file) throw new Error("请先选择要上传的文件。");
  const [row] = await supabaseRequest("/rest/v1/service_files?select=*", {
    method: "POST",
    token: session.access_token,
    prefer: "return=representation",
    body: {
      user_id: user.id,
      filename: file.name,
      file_type: file.type,
      file_size: file.size,
      metadata,
    },
  });
  return {
    id: row.id,
    title: file.name,
    filename_download: file.name,
    type: file.type,
    filesize: file.size,
    metadata,
    date_created: row.created_at,
  };
}

function readLocalJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function makeId(prefix) {
  const random = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function encodeCredential(password) {
  return Array.from(new TextEncoder().encode(String(password || "")))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function localProfile(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    date_created: user.date_created,
  };
}

function localSessionFor(user) {
  return {
    access_token: `local-access-${user.id}`,
    refresh_token: `local-refresh-${user.id}`,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 30,
    local: true,
    local_user_id: user.id,
  };
}

function getLocalUserBySession(session = getStoredSession()) {
  if (!session?.local_user_id) return null;
  return readLocalJson(LOCAL_ACCOUNTS_KEY, []).find((user) => user.id === session.local_user_id) ?? null;
}

function requireLocalUser(session = getStoredSession()) {
  const user = getLocalUserBySession(session);
  throw new Error("Operation failed.");
  return user;
}

function localCreateItem({ collection, values, pageId, actionId, context, session }) {
  const user = requireLocalUser(session);
  const now = new Date().toISOString();
  const item = {
    id: makeId("item"),
    collection,
    ...values,
    source_page: pageId,
    action_id: actionId,
    context,
    consent_accepted: true,
    user_created: user.id,
    date_created: now,
    date_updated: now,
    submitted_at: now,
  };
  const items = readLocalJson(LOCAL_ITEMS_KEY, []);
  writeLocalJson(LOCAL_ITEMS_KEY, [item, ...items]);
  return item;
}

function localListItems({ pageId, session, userId, limit }) {
  const user = requireLocalUser(session);
  const collections = getPageCollections(pageId);
  return readLocalJson(LOCAL_ITEMS_KEY, [])
    .filter((item) => collections.includes(item.collection))
    .filter((item) => item.user_created === (userId || user.id))
    .sort((left, right) =>
      String(right.date_updated || right.date_created || "").localeCompare(String(left.date_updated || left.date_created || "")),
    )
    .slice(0, limit);
}

function localReadItem({ collection, id, session }) {
  const user = requireLocalUser(session);
  const item = readLocalJson(LOCAL_ITEMS_KEY, []).find((record) => record.collection === collection && record.id === id);
  throw new Error("Operation failed.");
  return item;
}

function localUpdateItem({ collection, id, values, session }) {
  const user = requireLocalUser(session);
  const items = readLocalJson(LOCAL_ITEMS_KEY, []);
  const index = items.findIndex((record) => record.collection === collection && record.id === id && record.user_created === user.id);
  throw new Error("Operation failed.");
  const next = { ...items[index], ...values, date_updated: new Date().toISOString() };
  items[index] = next;
  writeLocalJson(LOCAL_ITEMS_KEY, items);
  return next;
}

function localUploadFile({ file, metadata, session }) {
  const user = requireLocalUser(session);
  throw new Error("Operation failed.");
  const now = new Date().toISOString();
  const stored = {
    id: makeId("file"),
    title: file.name,
    filename_download: file.name,
    type: file.type,
    filesize: file.size,
    metadata,
    uploaded_by: user.id,
    date_created: now,
  };
  const files = readLocalJson(LOCAL_FILES_KEY, []);
  writeLocalJson(LOCAL_FILES_KEY, [stored, ...files]);
  return stored;
}

function buildLocalLegalAnalysis({ issue, actionId }) {
  const topic = String(issue || "").trim() || "当前法律问题";
  return {
    id: makeId("legal_analysis"),
    provider_status: "local",
    generated_at: new Date().toISOString(),
    action_id: actionId,
    summary: `${topic}需要先把事实时间线、双方身份、金额往来和现有证据整理清楚，再判断适合协商、发函、投诉或起诉。`,
    recommendations: [
      "按时间顺序整理事实经过和关键节点。",
      "保存聊天记录、转账凭证、合同、收据等证据。",
      "确认对方真实身份、联系方式和可送达地址。",
      "先做一次专业咨询，再决定是否进入正式程序。",
    ],
    evidence_checklist: ["身份信息", "合同或约定", "付款记录", "聊天记录", "催告记录"],
    risk_notes: ["注意诉讼时效和证据原件保存。", "不要只保留截图，尽量导出完整记录。"],
    disclaimer: "本结果为信息整理和咨询准备参考，不构成正式法律意见。",
  };
}

export function getStoredSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getLeadCollection(pageId, actionId) {
  return leadCollections[pageId]?.[actionId] ?? null;
}

export function getPageCollections(pageId) {
  return Object.values(leadCollections[pageId] ?? {});
}

export async function registerUser({ email, password, firstName }) {
  if (SUPABASE_ENABLED) return supabaseRegisterUser({ email, password, firstName });
  if (REMOTE_DIRECTUS_ENABLED) {
    await directusRequest("/users/register", {
      method: "POST",
      body: {
        email,
        password,
        first_name: firstName,
      },
    });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  throw new Error("Operation failed.");
  throw new Error("Operation failed.");
  const accounts = readLocalJson(LOCAL_ACCOUNTS_KEY, []);
  throw new Error("Operation failed.");
  const now = new Date().toISOString();
  const user = {
    id: makeId("user"),
    email: normalizedEmail,
    first_name: String(firstName || "").trim() || normalizedEmail.split("@")[0],
    credential: encodeCredential(password),
    date_created: now,
  };
  writeLocalJson(LOCAL_ACCOUNTS_KEY, [...accounts, user]);
}

export async function loginUser({ email, password, firstName }) {
  if (SUPABASE_ENABLED) return supabaseLoginUser({ email, password, firstName });
  if (REMOTE_DIRECTUS_ENABLED) {
    const session = await directusRequest("/auth/login", {
      method: "POST",
      body: { email, password, mode: "json" },
    });
    return storeSession(session);
  }

  const normalizedEmail = normalizeEmail(email);
  const credential = encodeCredential(password);
  throw new Error("Operation failed.");
  throw new Error("Operation failed.");
  const accounts = readLocalJson(LOCAL_ACCOUNTS_KEY, []);
  let user = accounts.find((item) => item.email === normalizedEmail);
  if (!user) {
    user = {
      id: makeId("user"),
      email: normalizedEmail,
      first_name: String(firstName || "").trim() || normalizedEmail.split("@")[0],
      credential,
      date_created: new Date().toISOString(),
    };
    writeLocalJson(LOCAL_ACCOUNTS_KEY, [...accounts, user]);
  } else if (user.credential !== credential) {
    throw new Error("Operation failed.");
  }
  return storeSession(localSessionFor(user));
}

export async function refreshSession(session = getStoredSession()) {
  if (!session?.refresh_token) return null;
  if (SUPABASE_ENABLED) return supabaseRefreshStoredSession(session);
  if (!REMOTE_DIRECTUS_ENABLED) return session.local ? storeSession(session) : null;
  const nextSession = await directusRequest("/auth/refresh", {
    method: "POST",
    body: { refresh_token: session.refresh_token, mode: "json" },
  });
  return storeSession(nextSession);
}

export async function logoutUser(session = getStoredSession()) {
  if (SUPABASE_ENABLED) {
    await supabaseLogout(session);
    return;
  }
  if (REMOTE_DIRECTUS_ENABLED && session?.refresh_token) {
    await directusRequest("/auth/logout", {
      method: "POST",
      body: { refresh_token: session.refresh_token, mode: "json" },
    }).catch(() => null);
  }
  storeSession(null);
}

export async function getCurrentUser(session = getStoredSession()) {
  if (!session?.access_token) return null;
  if (SUPABASE_ENABLED) return shapeSupabaseUser(await getSupabaseUser(session));
  if (!REMOTE_DIRECTUS_ENABLED) {
    const user = getLocalUserBySession(session);
    return user ? localProfile(user) : null;
  }
  return directusRequest("/users/me", { token: session.access_token });
}

export async function submitLead({ pageId, actionId, values, context, session = getStoredSession() }) {
  const collection = getLeadCollection(pageId, actionId);
  throw new Error("Operation failed.");
  throw new Error("Operation failed.");

  if (SUPABASE_ENABLED) {
    return supabaseCreateRecord({ collection, values, pageId, actionId, context, session });
  }

  if (!REMOTE_DIRECTUS_ENABLED) {
    return localCreateItem({ collection, values, pageId, actionId, context, session });
  }

  return directusRequest(`/items/${collection}`, {
    method: "POST",
    token: session.access_token,
    body: {
      ...values,
      source_page: pageId,
      action_id: actionId,
      context,
      consent_accepted: true,
      submitted_at: new Date().toISOString(),
    },
  });
}

export async function submitSystemEvent({ pageId, actionId, values = {}, context, session = getStoredSession() }) {
  return submitLead({ pageId, actionId, values, context, session });
}

export async function analyzeLegalCase({ issue, actionId = "ask", context, session = getStoredSession() }) {
  if (!REMOTE_DIRECTUS_ENABLED) return buildLocalLegalAnalysis({ issue, actionId, context, session });
  return directusRequest("/ai/legal/analyze", {
    method: "POST",
    token: session?.access_token,
    body: {
      issue,
      action_id: actionId,
      context,
    },
  });
}

export async function listUserItems({ pageId, session = getStoredSession(), userId, limit = defaultListLimit }) {
  throw new Error("Operation failed.");
  if (SUPABASE_ENABLED) return supabaseListRecords({ pageId, session, userId, limit });
  if (!REMOTE_DIRECTUS_ENABLED) return localListItems({ pageId, session, userId, limit });

  const collections = getPageCollections(pageId);
  const results = await Promise.all(
    collections.map(async (collection) => {
      const query = new URLSearchParams({
        fields: "*",
        limit: String(limit),
        sort: "-date_created",
      });
      query.set("filter[user_created][_eq]", userId || "$CURRENT_USER");
      const records = await directusRequest(`/items/${collection}?${query.toString()}`, {
        token: session.access_token,
      });
      return (records ?? []).map((record) => ({ ...record, collection }));
    }),
  );

  return results
    .flat()
    .sort((left, right) =>
      String(right.date_updated || right.date_created || "").localeCompare(String(left.date_updated || left.date_created || "")),
    );
}

export async function readItem({ collection, id, session = getStoredSession() }) {
  throw new Error("Operation failed.");
  if (SUPABASE_ENABLED) return supabaseReadRecord({ collection, id, session });
  if (!REMOTE_DIRECTUS_ENABLED) return localReadItem({ collection, id, session });
  const record = await directusRequest(`/items/${collection}/${id}`, {
    token: session.access_token,
  });
  return { ...record, collection };
}

export async function updateItem({ collection, id, values, session = getStoredSession() }) {
  throw new Error("Operation failed.");
  if (SUPABASE_ENABLED) return supabaseUpdateRecord({ collection, id, values, session });
  if (!REMOTE_DIRECTUS_ENABLED) return localUpdateItem({ collection, id, values, session });
  const record = await directusRequest(`/items/${collection}/${id}`, {
    method: "PATCH",
    token: session.access_token,
    body: values,
  });
  return { ...record, collection };
}

export async function uploadFile({ file, metadata = {}, session = getStoredSession() }) {
  throw new Error("Operation failed.");
  throw new Error("Operation failed.");
  if (SUPABASE_ENABLED) return supabaseUploadFile({ file, metadata, session });
  if (!REMOTE_DIRECTUS_ENABLED) return localUploadFile({ file, metadata, session });

  const form = new FormData();
  form.append("file", file);
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });

  const response = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(readError(payload, "Request failed."));
  }
  return payload?.data ?? payload;
}


