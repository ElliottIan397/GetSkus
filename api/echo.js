// Simple echo API for debugging what Voiceflow sends

export default async function handler(req, res) {
  const { query } = req;

  return res.status(200).json({
    message: "Echo of query received",
    received_query: query
  });
}
