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

  // Step 2: Enrich in parallel (enrich up to 60, show top 20)
  const enrichPromises = allTitles.slice(0, 60).map((t) => enrichSingle(t, mediaType));
  const enrichResults = await Promise.allSettled(enrichPromises);
  const enriched = enrichResults
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);

  // Step 3: Sort by RT score, fall back to IMDb rating (scaled to 0-100)
  function sortScore(x) {
    if (x.rt_score !== null) return x.rt_score;
    const imdb = parseFloat(x.imdb_rating);
    return isNaN(imdb) ? 0 : imdb * 10;
  }
  enriched.sort((a, b) => sortScore(b) - sortScore(a));

  // If "similar to" and original title is available, pin it at #1
  if (similarTo && originalTitle) {
    const originalEnriched = await enrichSingle(originalTitle, mediaType);
    if (originalEnriched) {
      originalEnriched.is_original = true;
      const filtered = enriched.filter((e) => e.imdb_id !== originalEnriched.imdb_id);
      enriched.length = 0;
      enriched.push(originalEnriched, ...filtered);
    }
  }

  const top20 = enriched.slice(0, 20);

  // Step 4: Batch Claude reviews (single API call for all 20)
  const reviews = await getBatchClaudeReviews(top20);
  for (const item of top20) {
    item.review_text = reviews[item.title] || null;
    item.review_source = item.review_text ? "AI-generated review" : null;
    delete item.plot;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results: top20, total_found: allTitles.length }),
  };
};
