// Cloudflare Pages Function: /api/tag-action
import { BASE_URLS, makeSearchXml, makeTagXml, parseXmlSearchResults, parseXmlTagResponse, jsonResponse } from "./_shared.js";

export async function onRequestPost(context) {
  try {
    const { platform, username, password, action, payload } = await context.request.json();
    const qualysBase = BASE_URLS[platform];
    if (!qualysBase) {
      return jsonResponse({ success: false, error: "Invalid platform" }, 400, context.request);
    }

    const auth = btoa(`${username}:${password}`);
    const headers = {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "text/xml",
      "Accept": "application/xml",
      "X-Requested-With": "Cloudflare Pages Qualys Setup",
    };

    if (action === "find") {
      const searchXml = makeSearchXml(payload.name);
      const res = await fetch(`${qualysBase}/qps/rest/2.0/search/am/tag`, {
        method: "POST",
        headers,
        body: searchXml,
      });
      const text = await res.text();
      const existing = parseXmlSearchResults(text, payload.name);
      return jsonResponse({ success: true, existing }, 200, context.request);
    }

    if (action === "create") {
      const createXml = makeTagXml(payload);
      const res = await fetch(`${qualysBase}/qps/rest/2.0/create/am/tag`, {
        method: "POST",
        headers,
        body: createXml,
      });
      const text = await res.text();
      const result = parseXmlTagResponse(text);
      return jsonResponse({ success: result.success, result }, 200, context.request);
    }

    return jsonResponse({ success: false, error: "Invalid action" }, 400, context.request);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500, context.request);
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
