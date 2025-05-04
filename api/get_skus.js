const CSV_URL = 'https://raw.githubusercontent.com/ElliottIan397/voiceflow2/main/VF_API_TestProject042925.csv';

export default async function handler(req, res) {
  let { sku_list, PrintVolume, micr } = req.query;

  console.log("INBOUND VF REQUEST:", req.query);

  try {
  sku_list = JSON.parse(sku_list);

  // Fix potential double quotes in Voiceflow inputs
  PrintVolume = (PrintVolume || "").replace(/^"+|"+$/g, '').toLowerCase();
  micr = (micr || "").replace(/^"+|"+$/g, '').toUpperCase();
} catch {
  return res.status(400).json({ error: 'Bad input format' });
}

  try {
    const response = await fetch(CSV_URL);
    const csvText = await response.text();
    const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
    const headers = headerLine.split(',').map(h => h.trim());

    const rows = lines.map(line => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() || ""]));
    });

    let candidates = rows.filter(r => sku_list.includes(r.sku));

    if (micr === 'MICR') {
      candidates = candidates.filter(r => r.class_code.includes('M'));
    } else {
      candidates = candidates.filter(r => !r.class_code.includes('M'));
    }

    if (PrintVolume === 'low') {
      candidates = candidates.filter(r => !r.class_code.includes('HY') && !r.class_code.includes('J'));
    } else if (PrintVolume === 'medium') {
      candidates = candidates.filter(r => !r.class_code.includes('J'));
    } else if (PrintVolume === 'high') {
      candidates = candidates.filter(r => r.class_code.includes('HY') || r.class_code.includes('J'));
    }

    // --- Yield prioritization logic
    const yieldPreference = ['HYJ', 'HY', 'J', ''];
    const getYieldRank = code => {
      if (code.includes('HYJ')) return 0;
      if (code.includes('HY')) return 1;
      if (code.includes('J')) return 2;
      return 3;
    };

    candidates.sort((a, b) => getYieldRank(a.class_code) - getYieldRank(b.class_code));
    const final_sku_list = candidates.length > 0 ? [candidates[0].sku] : [];

    console.log("🔍 VF API OUTPUT:", {
      incoming_skus: sku_list,
      print_volume: PrintVolume,
      micr: micr,
      filtered_candidates: candidates.map(c => ({ sku: c.sku, class_code: c.class_code })),
      final_sku_list: final_sku_list
    });

    return res.status(200).json({ final_sku_list });

  } catch (err) {
    console.error('Processing error:', err);
    return res.status(500).json({ error: 'CSV fetch or parse failed' });
  }
}
