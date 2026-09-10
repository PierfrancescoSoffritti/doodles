const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.DISTANCE_OUTPUT || '/tmp/distance-transition-checks';
const baseline = process.env.DISTANCE_BASELINE_DIR;
const url = process.env.DISTANCE_URL || 'http://127.0.0.1:8791/25_Nowherelands_II/?seed=umbra&fps=30';

(async () => {
	fs.mkdirSync(output, { recursive: true });
	const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
	const results = [];
	try {
		for (const mode of baseline ? ['before', 'after'] : ['after']) {
			const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
			page.on('pageerror', e => errors.push(String(e)));
			page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 1000)); });
			if (baseline) await page.route('**/*distance-baseline=1', route => {
				const file = path.join(baseline, path.basename(new URL(route.request().url()).pathname));
				const body = fs.readFileSync(file, 'utf8').replace(/from '(\.\/[^']+\.js)'/g, (match, dep) => fs.existsSync(path.join(baseline, path.basename(dep))) ? `from '${dep}?distance-baseline=1'` : match);
				return route.fulfill({ contentType: 'text/javascript', body });
			});
			await page.addInitScript(() => { let state = 91273; Math.random = () => { state = Math.imul(state, 1664525) + 1013904223 | 0; return (state >>> 0) / 4294967296; }; });
			if (mode === 'before') await page.route('**/js/world/*.js*', route => {
				const file = path.join(baseline, path.basename(new URL(route.request().url()).pathname));
				return fs.existsSync(file) ? route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(file, 'utf8') }) : route.continue();
			});
			await page.route('**/js/main.js*', async route => {
				const r = await route.fetch();
				const body = (await r.text()).replace('requestAnimationFrame(frame);', 'requestAnimationFrame(frame); if (window.__distancePause) return;');
				await route.fulfill({ response: r, body });
			});
			await page.goto(url); await page.waitForFunction(() => window.__debug, { timeout: 120000 });
			await page.waitForTimeout(12000);
			const result = await page.evaluate(async () => {
				window.__distancePause = true;
				const checks = await import('./tests/browser/DistanceTransitionChecks.js');
				const ocean = checks.measureOceanEdge(), plants = checks.measureSmallPlants();
				let regression = 'pass';
				try { checks.assertDistanceTransitions(ocean, plants); } catch (e) { regression = e.message; }
				return { ocean, plants, regression };
			});
			if (process.env.DISTANCE_SCENE === '1') {
				const scene = await page.evaluate(async () => {
					const checks = await import('./tests/browser/DistanceTransitionSceneChecks.js');
					const deletion = checks.measureVegetationDeletion();
					const culling = checks.checkFadedVegetationCulling();
					const cost = await checks.measureDistanceRenderCost();
					return { deletion, culling, cost };
				});
				for (const image of scene.deletion.images) fs.writeFileSync(path.join(output, `${mode}-field-${image.elevation}.png`), Buffer.from(image.data.split(',')[1], 'base64'));
				delete scene.deletion.images; result.scene = scene;
				console.log(mode + ' scene', JSON.stringify(scene));
				if (mode === 'after' && baseline) {
					result.pairedCost = await page.evaluate(async () => (await import('./tests/browser/DistanceTransitionPairedCost.js')).measurePairedCost());
					console.log('paired cost', JSON.stringify(result.pairedCost));
				}
			}
			const images = result.plants.images; delete result.plants.images;
			const kinds = result.plants.reports.map(r => r.kind);
			const html = `<body style="background:#161820;color:#eee;font:14px system-ui;margin:24px"><h1>${mode}: production plants, maximum wind and pulse</h1><p>Orthographic inspection at the labelled player distances. Each row uses a real generated plant and its game material.</p><table><tr><th>Plant</th>${result.plants.distances.map(d => `<th>${d} units</th>`).join('')}</tr>${kinds.map(kind => `<tr><th>${kind}</th>${images.filter(i => i.kind === kind).map(i => `<td><img width="144" height="144" src="${i.data}"></td>`).join('')}</tr>`).join('')}</table></body>`;
			fs.writeFileSync(path.join(output, `${mode}-plants.html`), html);
			const sheet = await browser.newPage({ viewport: { width: 1200, height: 1450 } });
			await sheet.setContent(html); await sheet.screenshot({ path: path.join(output, `${mode}-plants.png`), fullPage: true }); await sheet.close();
			result.mode = mode; result.errors = errors; results.push(result);
			console.log(mode, JSON.stringify({ regression: result.regression, oceanGap: result.ocean.maxGap, plants: result.plants.reports.map(r => ({ kind: r.kind, counts: r.counts })), errors }));
			await page.close();
		}
		if (results.length === 2) {
			const [a, b] = results;
			const near = b.plants.reports.map((r, i) => ({ kind: r.kind, sameNearPixels: r.hashes[0] === a.plants.reports[i].hashes[0], same640Pixels: r.hashes[1] === a.plants.reports[i].hashes[1] }));
			const maxNearWaveDifference = Math.max(...b.ocean.controls.map((v, i) => Math.abs(v - a.ocean.controls[i])));
			console.log('controls', JSON.stringify({ near, maxNearWaveDifference }));
			b.controls = { near, maxNearWaveDifference };
			if (near.some(r => !r.sameNearPixels || !r.same640Pixels) || maxNearWaveDifference > 0.00001) process.exitCode = 1;
		}
		fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
		if (results.at(-1).regression !== 'pass' || results.some(r => r.errors.length)) process.exitCode = 1;
		if (results.at(-1).scene?.deletion.reports.some(r => r.removal.pixels > r.control.pixels + 2 || r.removal.rms > r.control.rms + 0.01)) process.exitCode = 1;
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
