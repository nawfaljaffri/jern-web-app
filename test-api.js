const https = require('https');
const fetchUrl = (url) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
    }).on('error', reject);
});

async function test() {
    const text = "the\nbe\nand\nof\na";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
    const res = await fetchUrl(url);
    console.log(res);
}
test();
