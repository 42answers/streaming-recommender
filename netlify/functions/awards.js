const { AWARD_OPTIONS } = require("./shared");

exports.handler = async () => {
  const list = Object.entries(AWARD_OPTIONS).map(([id, name]) => ({ id, name }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list),
  };
};
