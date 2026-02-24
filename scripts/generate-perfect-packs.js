const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../public/data');

const fetchUrl = (url) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
    }).on('error', reject);
});

async function translateBatch(words, targetLang) {
    // targetLang: es, de, ru, ar, ur, zh-CN
    const text = words.join('\n');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&dt=rm&q=${encodeURIComponent(text)}`;

    try {
        const responseData = await fetchUrl(url);
        const json = JSON.parse(responseData);

        // json[0] is array of translated parts
        // json[0][i][0] is translated word 
        // json[0][i][1] is original english word

        // Romanizations are sometimes in json[0][length-1][3] as a single \n separated string
        let translations = [];
        let romanizedStr = "";

        for (const item of json[0]) {
            if (item[0] && item[1]) {
                translations.push(item[0].trim());
            } else if (!item[0] && !item[1] && item[2] && typeof item[2] === 'string') {
                // The romanization block is at index 2 for target language
                romanizedStr = item[2];
            }
        }

        // Sometimes romanization is missing (like for Spanish/German)
        let romanizations = romanizedStr ? romanizedStr.split('\n').map(r => r.trim()) : translations;

        if (targetLang === 'ja' && romanizations.length === 1) {
            romanizations = romanizedStr.split(' ').map(r => r.trim());
        }

        return words.map((w, i) => ({
            original: translations[i] || w,
            romanized: (romanizations[i] || translations[i] || w).toLowerCase(),
            definition: w
        }));

    } catch (e) {
        console.error("Translation error for block:", e.message);
        return words.map(w => ({ original: w, romanized: w, definition: w }));
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    console.log("Fetching top 500 English words...");
    const enData = await fetchUrl('https://raw.githubusercontent.com/frekwencja/most-common-words-multilingual/main/data/wordfrequency.info/en.txt');
    const words = enData.split('\n').map(w => w.trim()).filter(w => w.length > 0 && w.toLowerCase() !== 'en').slice(0, 5000);

    const languages = [
        { code: 'ar', name: 'ar' },
        { code: 'ur', name: 'ur' },
        { code: 'zh-CN', name: 'zh' }, // API uses zh-CN, we save as zh.json
        { code: 'ru', name: 'ru' },
        { code: 'es', name: 'es' },
        { code: 'de', name: 'de' },
        { code: 'fr', name: 'fr' },
        { code: 'ko', name: 'ko' },
        { code: 'ja', name: 'ja' }
    ];

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const lang of languages) {
        console.log(`Generating perfect data pack for ${lang.name}...`);
        let jernData = [];
        const batchSize = 50;

        for (let i = 0; i < words.length; i += batchSize) {
            const batch = words.slice(i, i + batchSize);
            const results = await translateBatch(batch, lang.code);

            results.forEach((r, idx) => {
                jernData.push({
                    id: `${lang.name}-${i + idx + 1}`,
                    original: r.original.replace(/[\n\r]/g, ''),
                    romanized: r.romanized.replace(/[\n\r]/g, ''),
                    definition: r.definition,
                    language: lang.name,
                    frequency: i + idx + 1
                });
            });
            await sleep(500); // Prevent rate limiting
        }

        fs.writeFileSync(path.join(OUTPUT_DIR, `${lang.name}.json`), JSON.stringify(jernData, null, 2));
        console.log(`Saved ${lang.name}.json (${jernData.length} words)`);
    }
}

run();
