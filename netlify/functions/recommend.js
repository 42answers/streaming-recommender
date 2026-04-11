const {
  PROVIDER_IDS, PROVIDER_NAMES,
  getGenreId, discoverTitles, discoverSimilar, discoverAwardWinners,
  enrichSingle, getBatchClaudeReviews,
} = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const data = JSON.parse(event.body);
  const genre = data.genre || "";
  const similarTo = data.similar_to || "";
  const award = data.award || "";
  const services = data.services || ["netflix", "amazon", "disney"];
  const mediaType = data.media_type || "movie";

  const providerIds = services
    .filter((s) => s in PROVIDER_IDS)
    .map((s) => PROVIDER_IDS[s]);

  if (!providerIds.length) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Select at least one streaming service" }),
    };
  }

  // Step 1: Collect candidate titles
  let allTitles = [];
  const seenIds = new Set();
  let originalTitle = null;

  if (award) {
    const titles = await discoverAwardWinners(award, providerIds);
    for (const t of titles) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); allTitles.push(t); }
    }
  } else if (similarTo) {
    // Check if the original title itself is available
    try {
      const { tmdbFetch, getWatchProviders } = require("./shared");
      const searchData = await tmdbFetch(`/search/${mediaType}`, { query: similarTo, language: "en-US" });
      const searchResults = searchData.results || [];
      if (searchResults.length) {
        const candidate = searchResults[0];
        const providers = await getWatchProviders(candidate.id, mediaType);
        const providerIdList = providers.map((p) => p.provider_id);
        if (providerIds.some((pid) => providerIdList.includes(pid))) {
          originalTitle = candidate;
          seenIds.add(candidate.id);
        }
      }
    } catch {}

    const titles = await discoverSimilar(similarTo, providerIds, mediaType);
    for (const t of titles) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); allTitles.push(t); }
    }
  } else if (genre) {
    const genreId = getGenreId(genre, mediaType);
    if (!genreId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: `Genre '${genre}' not found` }),
      };
    }
    const titles = await discoverTitles(genreId, providerIds, mediaType);
    for (const t of titles) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); allTitles.push(t); }
    }
  } else {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Enter a genre, movie title, or select an award" }),
    };
  }

  // Step 2: Enrich in batches of 15 to avoid TMDB/OMDb rate limits
  let enriched = [];
  const BATCH_SIZE = 15;
  for (let i = 0; i < allTitles.length; i += BATCH_SIZE) {
    const batch = allTitles.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((t) => enrichSingle(t, mediaType)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) enriched.push(r.value);
    }
  }

  // Step 3: Quality floor — keep if RT >= 60% OR IMDb >= 6.5 (or no RT: IMDb >= 6.0)
  enriched = enriched.filter((e) => {
    const rt = e.rt_score;
    const imdb = parseFloat(e.imdb_rating) || 0;
    if (rt === null) return imdb >= 6.0;
    return rt >= 60 || imdb >= 6.5;
  });

  // Sort by blended score: RT (40%) + IMDb (40%) + TMDB (20%)
  function blendedScore(x) {
    const rt = x.rt_score; // 0-100 or null
    const imdbRaw = parseFloat(x.imdb_rating);
    const imdb = isNaN(imdbRaw) ? null : imdbRaw * 10;
    const tmdb = (x.tmdb_score || 0) * 10;

    const scores = [];
    const weights = [];
    if (rt !== null) { scores.push(rt); weights.push(0.4); }
    if (imdb !== null) { scores.push(imdb); weights.push(0.4); }
    if (tmdb > 0) { scores.push(tmdb); weights.push(0.2); }

    if (!scores.length) return 0;
    const totalW = weights.reduce((a, b) => a + b, 0);
    return scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;
  }
  enriched.sort((a, b) => blendedScore(b) - blendedScore(a));

  // If "similar to" and original title is available, pin it at #1
  if (similarTo && originalTitle) {
    const originalEnriched = await enrichSingle(originalTitle, mediaType);
    if (originalEnriched) {
      originalEnriched.is_original = true;
      enriched = [originalEnriched, ...enriched.filter((e) => e.imdb_id !== originalEnriched.imdb_id)];
    }
  }

  // Step 4: Batch Claude reviews for top 20 (single API call)
  const top20 = enriched.slice(0, 20);
  const reviews = await getBatchClaudeReviews(top20);
  for (const item of top20) {
    item.review_text = reviews[item.title] || null;
    item.review_source = item.review_text ? "AI-generated review" : null;
    delete item.plot;
  }

  // Keep remaining enriched results (without reviews yet) for "load more"
  const remaining = enriched.slice(20);
  for (const item of remaining) {
    item.review_text = null;
    item.review_source = null;
    delete item.plot;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results: enriched, total_found: allTitles.length }),
  };
};
