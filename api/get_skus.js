const CSV_URL = 'https://eandssolutions-my.sharepoint.com/:x:/p/ianelliott/Ea7VC-02OP9CgxcJH8DbZ_YBViSpmmpQ1F8TDwhNmdeXjQ?download=1';

function micrAllowed(code, micr) {
  const hasM = code.toUpperCase().includes('M');
  return micr === 'MICR' ? hasM : !hasM;
}

function yieldAllowed(code, volume) {
  const upper = code.toUpperCase();
  if (volume === 'low') return !upper.includes('HY') && !upper.includes('J');
  if (volume === 'medium') return upper.includes('J') && !upper.includes('HY');
  if (volume === 'high') return upper.includes('HY') || upper.includes('J');
  return false;
}

function parseCsvManually(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

export default async function handler(req, res) {
  const { sku_list, print_volume = '', micr = '' } = req.query;

  if (!sku_list || !print_volume) {
    return res.status(400).json({ error: 'Missing one or more required parameters.' });
  }

  try {
    const allowedSKUs = Array.isArray(sku_list)
      ? sku_list
      : JSON.parse(sku_list);

    const response = await fetch(CSV_URL);
    const csvText = await response.text();

    const records = parseCsvManually(csvText);

    const filtered = records.filter(row =>
      allowedSKUs.includes(row.sku) &&
      micrAllowed(row.class_code, micr) &&
      yieldAllowed(row.class_code, print_volume.toLowerCase())
    );

    const results = filtered.length > 0
      ? filtered
      : records.filter(row => allowedSKUs.includes(row.sku)); // fallback

    const final_sku_list = results.map(p => p.sku);
    const products = results.map(p => ({
      sku: p.sku,
      product_url: p.product_url,
      image_url: p.image_url
    }));

    return res.status(200).json({ final_sku_list, products });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Server error processing SKU list.' });
  }
}
