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

    // Yield prioritization logic for all SKUs
    const getYieldRank = code => {
      const cc = code.toUpperCase().slice(1); // ignore build style
      if (cc.includes('HY') && cc.includes('J')) return 3;
      if (cc.includes('HY')) return 2;
      if (cc.includes('J')) return 1;
      return 0; // STD yield
    };

    if (micr === 'MICR') {
      candidates = candidates.filter(r => r.class_code.toUpperCase().includes('M'));
    } else {
      candidates = candidates.filter(r => !r.class_code.toUpperCase().includes('M'));

      if (PrintVolume === 'low') {
        candidates = candidates.filter(r => {
          const cc = r.class_code.toUpperCase().slice(1);
          return !cc.includes('HY') && !cc.includes('J');
        });
      } else if (PrintVolume === 'medium') {
        candidates = candidates.filter(r => {
          const cc = r.class_code.toUpperCase().slice(1);
          return !cc.includes('J');
        });
      } else if (PrintVolume === 'high') {
        candidates = candidates.filter(r => {
          const cc = r.class_code.toUpperCase().slice(1);
          return cc.includes('HY') || cc.includes('J');
        });
      }
    }

    candidates.sort((a, b) => getYieldRank(a.class_code) - getYieldRank(b.class_code));
    const final_sku_list = candidates.length > 0 ? [candidates[0].sku] : [];

    console.log("\uD83D\uDD0D VF API OUTPUT:", {
      incoming_skus: sku_list,
      PrintVolume: PrintVolume,
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
