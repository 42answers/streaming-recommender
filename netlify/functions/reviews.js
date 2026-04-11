const { getBatchClaudeReviews } = require("./shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const data = JSON.parse(event.body);
  const titles = data.titles || [];
  const reviews = await getBatchClaudeReviews(titles);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviews }),
  };
};
