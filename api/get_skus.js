// get_skus.js - Updated filtering logic for MICR and PrintVolume

const CSV_URL = 'https://raw.githubusercontent.com/ElliottIan397/voiceflow2/main/VF_API_TestProject042925.csv';

export default async function handler(req, res) {
  let { sku_list, PrintVolume, micr } = req.query;

  if (!sku_list) {
    return res.status(400).json({ error: 'Missing sku_list' });
  }

  try {
    sku_list = JSON.parse(sku_list);
  } catch {
    return res.status(400).json({ error: 'Invalid sku_list format — must be JSON array' });
  }

  // Normalize input strings
  if (typeof PrintVolume === 'string') {
    PrintVolume = PrintVolume.replace(/^"|"$/g, '').trim().toLowerCase();
  }
  if (typeof micr === 'string') {
    micr = micr.replace(/^"|"$/g, '').trim().toUpperCase();
  }

  // Debug log
  console.log('CLEANED INPUTS:', { sku_list, PrintVolume, micr });

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

    // --- MICR filtering ---
    if (micr === 'MICR') {
      candidates = candidates.filter(r => r.class_code.toUpperCase().includes('M'));
    } else {
      candidates = candidates.filter(r => !r.class_code.toUpperCase().includes('M'));
    }

    // --- PrintVolume filtering ---
    if (PrintVolume === 'low') {
      candidates = candidates.filter(r =>
        !r.class_code.toUpperCase().includes('HY') &&
        !r.class_code.toUpperCase().includes('J')
      );
    } else if (PrintVolume === 'medium') {
      // Medium allows all except HYJ, HYJ2, etc. (keep standard + jumbo)
      candidates = candidates.filter(r =>
        !r.class_code.toUpperCase().includes('HYJ')
      );
    } else if (PrintVolume === 'high') {
      candidates = candidates.filter(r =>
        r.class_code.toUpperCase().includes('HY') ||
        r.class_code.toUpperCase().includes('J')
      );
    }

    const final_sku_list = candidates.map(r => r.sku);

    return res.status(200).json({ final_sku_list });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Failed to fetch or process CSV' });
  }
}
