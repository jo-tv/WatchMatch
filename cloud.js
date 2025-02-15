addEventListener("fetch", event => {
 event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
 let streamUrl = "https://google-com-globle.koyeb.app/stream/5.ts";
 let cache = caches.default;

 try {
  // ✅ تحميل الجزء الأول مسبقًا لتقليل وقت بدء التشغيل
  let initialResponse = await preloadSegment(streamUrl);
  if (!initialResponse.ok) {
   return new Response(`❌ خطأ في البث: ${initialResponse.status} - ${initialResponse.statusText}`, { status: initialResponse.status });
  }

  // ✅ ضبط التخزين المؤقت لمنع التقطيع
  let newHeaders = new Headers(initialResponse.headers);
  newHeaders.set("Cache-Control", "public, max-age=8, stale-while-revalidate=2");

  let cachedResponse = new Response(initialResponse.body, {
   status: initialResponse.status,
   headers: newHeaders
  });

  // ✅ تحميل الجزء التالي أثناء تشغيل الحالي (قبل الانتهاء بـ 3 ثوانٍ)
  event.waitUntil(preloadNextSegment(streamUrl));

  return cachedResponse;

 } catch (error) {
  console.error("⚠️ خطأ في تحميل البث:", error.message);
  return new Response(`❌ Worker Error: ${error.message}`, { status: 500 });
 }
}

// ✅ تحميل الجزء الأول لتقليل وقت بدء التشغيل
async function preloadSegment(streamUrl) {
 return await fetch(streamUrl, {
  method: "GET",
  headers: {
   "User-Agent": "Mozilla/5.0",
   "Referer": "http://sansat.cc:88/live/",
   "Origin": "http://sansat.cc:88/live",
   "Accept": "*/*",
   "Accept-Encoding": "gzip, deflate, br",
   "Connection": "keep-alive"
  }
 });
}

// ✅ تحميل الجزء القادم قبل نهاية الحالي بـ 3 ثوانٍ
async function preloadNextSegment(streamUrl) {
 try {
  await new Promise(resolve => setTimeout(resolve, 5000)); // انتظر 5 ثوانٍ قبل تحميل الجزء التالي
  await fetch(streamUrl, {
   method: "GET",
   headers: { "User-Agent": "Mozilla/5.0" },
   cf: { cacheTtl: 8 } // التخزين لـ 8 ثوانٍ
  });
  console.log("✅ الجزء القادم تم تحميله مسبقًا.");
 } catch (err) {
  console.error("⚠️ فشل تحميل الجزء القادم مسبقًا:", err.message);
 }
}