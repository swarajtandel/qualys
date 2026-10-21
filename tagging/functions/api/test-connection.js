// Cloudflare Pages Function: /api/test-connection
import { BASE_URLS, makeSearchXml, jsonResponse } from "./_shared.js";

export async function onRequestPost(context) {
  try {
    const { platform, username, password } = await context.request.json();
    if (!platform || !BASE_URLS[platform]) {
      return jsonResponse({ success: false, error: "Invalid platform selection" }, 400, context.request);
    }
    if (!username || !password) {
      return jsonResponse({ success: false, error: "Username and password required" }, 400, context.request);
    }

    const qualysBase = BASE_URLS[platform];
    const searchXml = makeSearchXml("OS: Operating Systems");
    const auth = btoa(`${username}:${password}`);

    const res = await fetch(`${qualysBase}/qps/rest/2.0/search/am/tag`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "text/xml",
        "Accept": "application/xml",
        "X-Requested-With": "Cloudflare Pages Qualys Setup",
      },
      body: searchXml,
    });

    const text = await res.text();
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      if (text) {
        const errMatch = text.match(/<(?:errorMessage|errorReason|responseErrorDetails|responseErrorMessage)>([^<]+)<\//i);
        const codeMatch = text.match(/<(?:responseCode|errorCode)>([^<]+)<\//i);
        errMsg = errMatch ? errMatch[1].trim() : (codeMatch ? codeMatch[1].trim() : `HTTP ${res.status}`);
      }
      return jsonResponse({ success: false, status: res.status, error: errMsg }, 401, context.request);
    }

    const isSuccess = text.includes("<responseCode>SUCCESS</responseCode>");
    let message = "Authentication successful and Qualys API reachable.";
    if (!isSuccess) {
      const errMatch = text.match(/<(?:errorMessage|errorReason|responseErrorDetails|responseErrorMessage)>([^<]+)<\//i);
      const codeMatch = text.match(/<(?:responseCode|errorCode)>([^<]+)<\//i);
      message = errMatch ? errMatch[1].trim() : (codeMatch ? codeMatch[1].trim() : "API returned unexpected response code.");
    }
    return jsonResponse({
      success: isSuccess,
      status: res.status,
      message,
      error: isSuccess ? null : message,
    }, isSuccess ? 200 : 400, context.request);
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
