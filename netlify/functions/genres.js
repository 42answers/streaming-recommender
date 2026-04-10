const { TMDB_GENRES, TV_GENRES } = require("./shared");

exports.handler = async (event) => {
  const mediaType = event.queryStringParameters?.media_type || "movie";
  const genres = mediaType === "movie" ? TMDB_GENRES : TV_GENRES;
  const list = Object.entries(genres)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list),
  };
};
