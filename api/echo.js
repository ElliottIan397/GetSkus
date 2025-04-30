// Simple echo API for debugging what Voiceflow sends

export default async function handler(req, res) {
  let { sku_list, micr, print_volume } = req.query;

  // Normalize types for consistency
  micr = String(micr || "").trim().toUpperCase();

  try {
    sku_list = JSON.parse(sku_list);
  } catch {
    return res.status(400).json({ error: "Invalid SKU list format" });
  }

  return res.status(200).json({
    message: "Echo of query received",
    received_query: {
      sku_list,
      micr,
      print_volume
    }
  });
}
