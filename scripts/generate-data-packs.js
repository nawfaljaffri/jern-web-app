const https = require('https');
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');
const { transliterate } = require('transliteration');

const OUTPUT_DIR = path.join(__dirname, '../public/data');

const fetchUrl = (url) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
    }).on('error', reject);
});

async function generateSMenigatPack(langCode, langValue) {
    console.log(`Generating pack for ${langValue}...`);
    try {
        const url = `https://raw.githubusercontent.com/SMenigat/thousand-most-common-words/master/words/${langCode}.json`;
        const data = JSON.parse(await fetchUrl(url));

        // Convert to JERN format
        const wordsArray = data.words || data;
        const jernData = wordsArray.map((item, index) => {
            let romanized = transliterate(item.targetWord).toLowerCase().replace(/[^a-z\'\-]/g, '');

            return {
                id: `${langValue}-${index + 1}`,
                original: item.targetWord,
                romanized: romanized || item.targetWord.toLowerCase().replace(/[^a-z\'\-]/g, ''),
                definition: item.englishWord,
                language: langValue,
                frequency: index + 1
            };
        });

        fs.writeFileSync(path.join(OUTPUT_DIR, `${langValue}.json`), JSON.stringify(jernData, null, 2));
        console.log(`Successfully generated ${langValue}.json (${jernData.length} words)`);
    } catch (e) {
        console.error(`Error for ${langValue}:`, e.message);
    }
}

async function generateRussianPack() {
    console.log('Generating Russian pack...');
    try {
        const url = 'https://raw.githubusercontent.com/alicewriteswrongs/russian-vocab/master/words.json';
        const data = JSON.parse(await fetchUrl(url));

        let index = 1;
        const jernData = [];
        for (const item of data) {
            jernData.push({
                id: `ru-${index}`,
                original: item[0],
                romanized: transliterate(item[0]).toLowerCase().replace(/[^a-z\'\-]/g, ''),
                definition: Array.isArray(item[1]) ? item[1][0] : (item[1] || "Translation"),
                language: 'ru',
                frequency: index
            });
            index++;
        }
        fs.writeFileSync(path.join(OUTPUT_DIR, `ru.json`), JSON.stringify(jernData, null, 2));
        console.log(`Successfully generated ru.json (${jernData.length} words)`);
    } catch (e) {
        console.error(`Error for Russian:`, e.message);
    }
}

async function generateChinesePack() {
    console.log('Generating Chinese pack...');
    try {
        const url = 'https://raw.githubusercontent.com/SMenigat/thousand-most-common-words/master/words/zh.json';
        const data = JSON.parse(await fetchUrl(url));

        const wordsArray = data.words || data;
        const jernData = wordsArray.map((item, index) => {
            return {
                id: `zh-${index + 1}`,
                original: item.targetWord,
                romanized: pinyin(item.targetWord, { toneType: 'none', type: 'string', v: true }).replace(/[^a-z\s]/g, '').replace(/\s+/g, ''),
                definition: item.englishWord,
                language: 'zh',
                frequency: index + 1
            };
        });

        fs.writeFileSync(path.join(OUTPUT_DIR, `zh.json`), JSON.stringify(jernData, null, 2));
        console.log(`Successfully generated zh.json (${jernData.length} words)`);
    } catch (e) {
        console.error(`Error for Chinese:`, e.message);
    }
}

async function run() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 1. SMenigat packs (ar, es, de, ur)
    // Note: SMenigat uses 'es' for Spanish, 'de' for German, 'ar' for Arabic, 'ur' for Urdu (if exists, else we might fallback)
    await generateSMenigatPack('es', 'es');
    await generateSMenigatPack('de', 'de');
    await generateSMenigatPack('ar', 'ar');
    await generateSMenigatPack('ur', 'ur'); // Will fail if not there, let's catch it.

    // 2. Specific Russian Pack
    await generateRussianPack();

    // 3. Specific Chinese Pack
    await generateChinesePack();
}

run();
