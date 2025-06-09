// Revision: v1.4.3
// CHANGELOG:
// - Aligned fallbackMap keys to use 'medium' instead of 'med'
// - Removed normalization logic; fallbackKey now matches exact Voiceflow input

const CSV_URL = 'https://raw.githubusercontent.com/ElliottIan397/voiceflow2/main/VF_API_TestProject042925.csv';

export default async function handler(req, res) {
  let { sku_list, PrintVolume, micr } = req.query;

  console.log("INBOUND VF REQUEST:", req.query);

  try {
    sku_list = JSON.parse(sku_list);
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

    const getYieldRank = code => {
      const cc = code.toUpperCase().slice(1);
      if (cc.includes('HY') && cc.includes('J')) return 3;
      if (cc.includes('HY')) return 2;
      if (cc.includes('J')) return 1;
      return 0;
    };

    const isMicr = micr === 'MICR';
    candidates = candidates.filter(r =>
      isMicr ? r.class_code.toUpperCase().includes('M') :
               !r.class_code.toUpperCase().includes('M')
    );

    const fallbackMap = {
      "low|":         ["", "J", "HY", "HYJ"],
      "medium|":      ["J", "HY", "", "HYJ"],
      "high|":        ["HY", "HYJ", "J", ""],
      "low|MICR":     ["M", "JM", "HYM", "HYJM"],
      "medium|MICR":  ["JM", "HYM", "HYJM", "M"],
      "high|MICR":    ["HYM", "HYJM", "JM", "M"]
    };

    const fallbackKey = `${PrintVolume}|${isMicr ? 'MICR' : ''}`;
    const preferences = fallbackMap[fallbackKey] || [];

    const fallbackMatch = (cc, pref) => {
      if (pref === "") return !cc.includes("HY") && !cc.includes("J") && !cc.includes("M");
      return cc === pref;
    };

    let filtered = [];
    for (const pref of preferences) {
      const match = candidates.filter(r => fallbackMatch(r.class_code.toUpperCase().slice(1), pref));
      console.log(`Checking fallback pref '${pref}':`, match.map(m => m.sku));
      if (match.length > 0) {
        filtered = match;
        break;
      }
    }
    if (filtered.length === 0) {
      filtered = candidates;
    }
    candidates = filtered;

    const uniqueYields = new Set(candidates.map(r => r.class_code.toUpperCase().slice(1)));
    if (uniqueYields.size > 1) {
      candidates.sort((a, b) => getYieldRank(b.class_code) - getYieldRank(a.class_code));
    }

    const blackSku = sku_list[0];
    if ((PrintVolume === 'low' || PrintVolume === 'medium') && candidates.some(c => c.sku === blackSku)) {
      candidates = [
        ...candidates.filter(c => c.sku === blackSku),
        ...candidates.filter(c => c.sku !== blackSku)
      ];
    }

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
