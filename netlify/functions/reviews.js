// Reviews are now pre-populated in the database.
// This endpoint is kept for backward compatibility with the "load more" button.
// It returns the reviews already present in the title data.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const data = JSON.parse(event.body);
  const titles = data.titles || [];

  // Reviews are already in the title data from the DB
  const reviews = {};
  for (const t of titles) {
    if (t.review_text) {
      reviews[t.title] = t.review_text;
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviews }),
  };
};
