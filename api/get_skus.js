const CSV_URL = 'https://raw.githubusercontent.com/ElliottIan397/voiceflow2/main/VF_API_TestProject042925.csv';

export default async function handler(req, res) {
  const { sku_list, print_volume, micr } = req.query;

  if (!sku_list) {
    return res.status(400).json({ error: 'Missing sku_list' });
  }

  let parsedSkuList;
  try {
    parsedSkuList = JSON.parse(sku_list);
  } catch {
    return res.status(400).json({ error: 'Invalid sku_list format — must be JSON array' });
  }

  try {
    const response = await fetch(CSV_URL);
    const csvText = await response.text();
    const lines = csvText.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v =>
        v.trim().replace(/^"|"$/g, '').replace(/\u00A0/g, '')
      );
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
    });

    // Filter to just SKUs provided
    let candidates = rows.filter(row => parsedSkuList.includes(row.sku));

    // MICR Filtering
    if (micr?.toUpperCase() === 'MICR') {
      candidates = candidates.filter(r => r.class_code.includes('M'));
    } else {
      candidates = candidates.filter(r => !r.class_code.includes('M'));
    }

    // Page Yield Filtering
    const pv = print_volume?.toLowerCase();
    if (pv === 'low') {
      candidates = candidates.filter(r => !r.class_code.includes('HY') && !r.class_code.includes('J'));
    } else if (pv === 'medium') {
      candidates = candidates.filter(r =>
        !r.class_code.includes('HY') || r.class_code.includes('J')
      );
    } else if (pv === 'high') {
      candidates = candidates.filter(r =>
        r.class_code.includes('HY') || r.class_code.includes('J')
      );
    }

    // Always return something — best fallback is first valid result
    const final_sku_list = candidates.map(r => r.sku);
    const products = candidates.map(r => ({
      sku: r.sku,
      product_url: r.product_url,
      image_url: r.image_url,
    }));

    return res.status(200).json({
      final_sku_list,
      products
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Failed to fetch or process CSV' });
  }
}
