const https = require('https');
const fs = require('fs');
const path = require('path');

const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                resolve(data); // might not be json
            }
        });
    }).on('error', reject);
});

async function findRepoFiles() {
    console.log("Checking repositories...");
    const repos = [
        'SMenigat/thousand-most-common-words',
        'frekwencja/most-common-words-multilingual',
        'alicewriteswrongs/russian-vocab',
        'rawmarshmellows/chinese-pinyin-JSON'
    ];

    for (const repo of repos) {
        try {
            const tree = await fetchJson(`https://api.github.com/repos/${repo}/git/trees/master?recursive=1`);
            if (tree.tree) {
                console.log(`\nFound files for ${repo}:`);
                const important = tree.tree.filter(t => t.path.includes('.json') || t.path.includes('.txt') || t.path.includes('.csv'));
                console.log(important.map(t => t.path).slice(0, 10)); // just print top 10
            } else {
                // try main branch
                const mainTree = await fetchJson(`https://api.github.com/repos/${repo}/git/trees/main?recursive=1`);
                if (mainTree.tree) {
                    console.log(`\nFound files for ${repo} (main):`);
                    const important = mainTree.tree.filter(t => t.path.includes('.json') || t.path.includes('.txt') || t.path.includes('.csv'));
                    console.log(important.map(t => t.path).slice(0, 10)); // just print top 10
                }
            }
        } catch (e) {
            console.log(`Error reading ${repo}: ${e.message}`);
        }
    }
}

findRepoFiles();
