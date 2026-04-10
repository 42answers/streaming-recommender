const {
  PROVIDER_IDS, PROVIDER_NAMES,
  getGenreId, getImdbId, getWatchProviders, getRtScore, omdbFetch,
  discoverTitles, discoverSimilar, discoverAwardWinners, getClaudeReview,
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

  let allTitles = [];
  const seenIds = new Set();

  if (award) {
    const titles = await discoverAwardWinners(award, providerIds);
    for (const t of titles) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); allTitles.push(t); }
    }
  } else if (similarTo) {
    const titles = await discoverSimilar(similarTo, providerIds, mediaType);
    for (const t of titles) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); allTitles.push(t); }
    }
  } else if (genre) {
    for (const pid of providerIds) {
      const genreId = getGenreId(genre, mediaType);
      if (!genreId) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: `Genre '${genre}' not found` }),
        };
      }
      const titles = await discoverTitles(genreId, pid, mediaType);
      for (const t of titles) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); allTitles.push(t); }
      }
    }
  } else {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Enter a genre, movie title, or select an award" }),
    };
  }

  // Enrich with OMDb data
  const enriched = [];
  for (const title of allTitles) {
    try {
      const imdbId = await getImdbId(title.id, mediaType);
      if (!imdbId) continue;

      const omdb = await omdbFetch(imdbId);
      if (omdb.Response === "False") continue;

      const rtScore = getRtScore(omdb);
      const name = title.title || title.name || "Unknown";
      const year = (title.release_date || title.first_air_date || "").slice(0, 4);

      const reviewText = await getClaudeReview(name, year, omdb.Plot || "");

      const providers = await getWatchProviders(title.id, mediaType);
      const availableOn = providers
        .filter((p) => p.provider_id in PROVIDER_NAMES)
        .map((p) => PROVIDER_NAMES[p.provider_id]);

      enriched.push({
        title: name,
        year,
        poster: `https://image.tmdb.org/t/p/w300${title.poster_path || ""}`,
        overview: title.overview || "",
        rt_score: rtScore,
        imdb_rating: omdb.imdbRating || "N/A",
        imdb_id: imdbId,
        genres: omdb.Genre || "",
        awards: omdb.Awards || "",
        review_text: reviewText,
        review_source: "AI-generated review",
        available_on: availableOn,
      });
    } catch {
      continue;
    }

    if (enriched.length >= 15) break;
  }

  enriched.sort((a, b) => {
    const aHas = a.rt_score !== null ? 1 : 0;
    const bHas = b.rt_score !== null ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return (b.rt_score || 0) - (a.rt_score || 0);
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results: enriched.slice(0, 10) }),
  };
};
