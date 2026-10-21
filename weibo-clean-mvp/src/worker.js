const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "weibo-clean", time: new Date().toISOString() });
    }

    if (url.pathname === "/api/hotsearch") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
      try {
        const data = await fetchWeiboHotSearch();
        return json({
          ok: true,
          source: "weibo-public-endpoint",
          fetchedAt: new Date().toISOString(),
          items: data
        }, 200, { "Cache-Control": "public, max-age=60, s-maxage=60" });
      } catch (error) {
        return json({
          ok: false,
          error: "暂时无法获取微博热搜。微博公开接口可能已调整或正在限流，请稍后重试。",
          detail: String(error?.message || error)
        }, 502);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

async function fetchWeiboHotSearch() {
  const response = await fetch("https://weibo.com/ajax/side/hotSearch", {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://weibo.com/",
      "User-Agent": "Mozilla/5.0 (compatible; WeiboClean/0.1)"
    },
    cf: { cacheTtl: 60, cacheEverything: true }
  });

  if (!response.ok) throw new Error(`上游返回 HTTP ${response.status}`);

  const payload = await response.json();
  const raw = payload?.data?.realtime || payload?.data?.hotgov || payload?.data?.band_list;
  if (!Array.isArray(raw)) {
    throw new Error("微博返回的数据结构与预期不一致");
  }

  const items = raw.map((item, index) => {
    const title = String(item?.note || item?.word || item?.title || "").trim();
    const word = String(item?.word || title).trim();
    const mid = item?.mid || item?.id || "";
    const url = item?.url
      ? normalizeUrl(item.url)
      : `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`;
    return {
      id: String(mid || `${index}-${title}`),
      title,
      url,
      rank: Number(item?.rank || index + 1),
      hot: item?.raw_hot ?? item?.num ?? item?.hot ?? null,
      category: String(item?.category || ""),
      label: String(item?.label_name || item?.icon_desc || ""),
      word
    };
  }).filter(item => item.title && /^https:\/\/(weibo\.com|s\.weibo\.com)\//.test(item.url));

  if (!items.length) throw new Error("接口返回了空榜单");
  return items.slice(0, 100);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value, "https://s.weibo.com");
    if (url.protocol !== "https:") return `https://s.weibo.com/weibo?q=${encodeURIComponent(value)}`;
    return url.href;
  } catch {
    return `https://s.weibo.com/weibo?q=${encodeURIComponent(value)}`;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...extraHeaders
    }
  });
}
