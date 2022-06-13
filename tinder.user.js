// ==UserScript==
// @name        Tinder Deblur
// @namespace   Violentmonkey Scripts
// @match       https://tinder.com/*
// @grant       none
// @version     2.0
// @author      Tajnymag
// @downloadURL https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js
// @description Simple script using the official Tinder API to get clean photos of the users who liked you
// ==/UserScript==

async function unblur() {
	const teasers = await fetch('https://api.gotinder.com/v2/fast-match/teasers', {
		headers: { 'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken') },
	})
		.then((res) => res.json())
		.then((res) => res.data.results);
	const teaserEls = document.querySelectorAll('.Expand.enterAnimationContainer > div:nth-child(1)');

	for (let i = 0; i < teaserEls.length; ++i) {
		const teaser = teasers[i];
		const teaserEl = teaserEls[i];

		const teaserImage = teaser.user.photos[0].url;

		teaserEl.style.backgroundImage = `url(${teaserImage})`;
	}
}

async function waitForApp() {
	return new Promise((resolve) => {
		new MutationObserver((_, me) => {
			let appEl = document.querySelector('.App');
			if (appEl) {
				me.disconnect();
				resolve(appEl);
			}
		}).observe(document, { subtree: true, childList: true });
	});
}

async function main() {
	// check if running as a userscript
	if (typeof GM_info === 'undefined') {
		console.warn(
			'[TINDER DEBLUR]: The only supported way of running this script is through a userscript management browser addons like Violentmonkey, Tampermonkey or Greasemonkey!'
		);
		console.warn(
			'[TINDER DEBLUR]: Script was not terminated, but you should really look into the correct way of running it.'
		);
	}

	// wait for a full page load
	const appEl = await waitForApp();

	// setup navigation observer
	const observer = new MutationObserver(() => {
		if (['/app/likes-you', '/app/gold-home'].includes(location.pathname)) {
			unblur();
		}
	});
	observer.observe(appEl, { subtree: true, childList: true });
}
main().catch(console.error);
