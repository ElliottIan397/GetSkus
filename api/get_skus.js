const CSV_URL = 'https://raw.githubusercontent.com/ElliottIan397/voiceflow2/main/VF_API_TestProject042925.csv';

export default async function handler(req, res) {
  let { sku_list, print_volume, micr } = req.query;

  // --- Parse SKU list
  if (!sku_list) {
    return res.status(400).json({ error: 'Missing sku_list' });
  }

  try {
    sku_list = JSON.parse(sku_list);
  } catch {
    return res.status(400).json({ error: 'Invalid sku_list format — must be JSON array' });
  }

  // --- Normalize string inputs from Voiceflow
  if (typeof print_volume === 'string') {
    print_volume = print_volume.replace(/^"|"$/g, '').trim().toLowerCase();
  }

  if (typeof micr === 'string') {
    micr = micr.replace(/^"|"$/g, '').trim().toUpperCase();
  }

  // 🔍 Log the cleaned parameters for debugging
  console.log('CLEANED INPUTS:', {
    sku_list,
    print_volume,
    micr
  });

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

    let candidates = rows.filter(row => sku_list.includes(row.sku));

    if (micr === 'MICR') {
      candidates = candidates.filter(r => r.class_code.includes('M'));
    } else {
      candidates = candidates.filter(r => !r.class_code.includes('M'));
    }

    if (print_volume === 'low') {
      candidates = candidates.filter(r => !r.class_code.includes('HY') && !r.class_code.includes('J'));
    } else if (print_volume === 'medium') {
      candidates = candidates.filter(r =>
        !r.class_code.includes('HY') || r.class_code.includes('J')
      );
    } else if (print_volume === 'high') {
      candidates = candidates.filter(r =>
        r.class_code.includes('HY') || r.class_code.includes('J')
      );
    }

    const final_sku_list = candidates.map(r => r.sku);

    return res.status(200).json({ final_sku_list });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Failed to fetch or process CSV' });
  }
}
