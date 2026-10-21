// Cloudflare Pages Function: /api/catalog
import { BASE_URLS, PARENTS, SKIPPED_RULES, jsonResponse } from "./_shared.js";

export async function onRequestGet(context) {
  return jsonResponse({
    platforms: Object.keys(BASE_URLS),
    parents: PARENTS,
    skipped: SKIPPED_RULES,
  }, 200, context.request);
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
