const {
  PROVIDER_IDS,
  getGenreId, blendedScore,
  queryByGenre, queryByTitle, queryByTitles, queryAwardTitles,
  getSimilarSuggestions, formatTitle,
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

  let results = [];
  let totalFound = 0;

  try {
    if (award) {
      // ─── Award search: DB lookup ───────────────────────
      const dbResults = await queryAwardTitles(award, providerIds);
      totalFound = dbResults.length;
      results = dbResults.map(formatTitle);

    } else if (similarTo) {
      // ─── Similar-to: Claude + DB lookup ────────────────
      // Check if original title is in DB
      let originalTitle = null;
      const original = await queryByTitle(similarTo);
      if (original && original.provider_ids.some((pid) => providerIds.includes(pid))) {
        originalTitle = formatTitle(original);
      }

      // Get Claude suggestions and match against DB
      const suggestions = await getSimilarSuggestions(similarTo, providerIds, mediaType);
      const dbResults = await queryByTitles(suggestions, providerIds, mediaType);
      totalFound = dbResults.length + (originalTitle ? 1 : 0);
      results = dbResults.map(formatTitle);

      // Pin original at #1 if found
      if (originalTitle) {
        results = [originalTitle, ...results.filter((r) => r.imdb_id !== originalTitle.imdb_id)];
      }

    } else if (genre) {
      // ─── Genre search: DB query ────────────────────────
      const genreId = getGenreId(genre, mediaType);
      if (!genreId) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: `Genre '${genre}' not found` }),
        };
      }
      const dbResults = await queryByGenre(genreId, providerIds, mediaType);
      totalFound = dbResults.length;
      results = dbResults.map(formatTitle);

    } else {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Enter a genre, movie title, or select an award" }),
      };
    }

    // Sort by blended score (with genre boost for genre searches)
    const sortGenreId = genre ? getGenreId(genre, mediaType) : null;
    results.sort((a, b) => blendedScore(b, sortGenreId) - blendedScore(a, sortGenreId));

    // Reviews are pre-populated from DB — no Claude call needed
    // Clean up internal fields not needed in response
    for (const item of results) {
      delete item.plot;
      delete item.genre_ids;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results, total_found: totalFound }),
    };
  } catch (err) {
    console.error("Recommend error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal error: " + err.message }),
    };
  }
};
