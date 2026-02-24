const fs = require('fs');
const http = require('https');

async function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function normalizeRomaji(r) {
    if (!r) return "";
    return r.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function fixFile(lang) {
    const p = `public/data/${lang}.json`;
    let data = JSON.parse(fs.readFileSync(p, 'utf8'));
    
    // We will do batches of 20 to ensure no dropped lines ruin large segments
    const BATCH_SIZE = 20;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const text = batch.map(w => w.definition).join('\n');
        
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
        const res = await fetchUrl(url);
        const parsed = JSON.parse(res);
        
        const translations = [];
        let romanizedStr = "";
        
        if (parsed[0]) {
            parsed[0].forEach(item => {
                if (item[0] && item[1]) translations.push(item[0].trim());
            });
            if (parsed[0].length > 0 && parsed[0][parsed[0].length - 1][3]) {
                romanizedStr = parsed[0][parsed[0].length - 1][3];
            } else if (parsed[1] && parsed[1][new String(lang)]) {
                // sometimes romanization is in parsed[0][last][2] or parsed[0][last][3]
            }
        }
        
        // This is too complex. Google Translate API is notoriously bad at batch romanization maintaining structures.
        // Let's just do 5 concurrent requests of 1 word each.
    }
}
