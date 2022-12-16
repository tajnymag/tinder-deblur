// ==UserScript==
// @name        Tinder Deblur
// @namespace   Violentmonkey Scripts
// @match       https://tinder.com/*
// @grant       none
// @version     2.7
// @author      Aiamay
// @downloadURL https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js
// @description Simple script using the official Tinder API to get clean photos of the users who liked you
// ==/UserScript==

/**
 * Core logic of the script
 */
async function unblur() {
	var UnblurredImageURL="";
	var user_id="UserID_24_chars";
	var user_url="https://api.gotinder.com/user/UserID_24_chars";
	var user_info="https://api.gotinder.com/user/UserID_24_chars";

	const teasers = await fetch('https://api.gotinder.com/v2/fast-match/teasers', {
		headers: {
			'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken'),
			platform: 'android'
		},
	})
		.then((res) => res.json())
		.then((res) => res.data.results);
	const teaserEls = document.querySelectorAll('.Expand.enterAnimationContainer > div:nth-child(1)');

	for (let i = 0; i < teaserEls.length; ++i) {
		const teaser = teasers[i];
		const teaserEl = teaserEls[i];

		if (teaser.user.photos[0].url.includes("preview")) {
//		[TINDER DEBLUR]: Deblurring likes from preview.gotinder.com
			UnblurredImageURL=teaser.user.photos[0].url
		}else{
//    [TINDER DEBLUR]: Deblurring likes from images-ssl.gotinder.com
			user_id=teaser.user.photos[0].url.slice(32,56);
			user_url="https://api.gotinder.com/user/";
			user_url=user_url.concat(user_id);
			UnblurredImageURL=await fetch(user_url, {
				headers: {
					'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken'),
					platform: 'android'
				},
			})
				.then((res) => res.json())
				.then((res) => res.results.photos[0].url);
		}
		const teaserImage = UnblurredImageURL;

		teaserEl.style.backgroundImage = `url(${teaserImage})`;
	}
}

/**
 * Awaits the first event of the specified listener
 * @param {EventTarget} target
 * @param {string} eventType
 * @returns {Promise<void>}
 */
async function once(target, eventType) {
	return new Promise((resolve) => {
		target.addEventListener(eventType, () => {
			target.removeEventListener(eventType, resolve);
			resolve();
		});
	});
}

/**
 * Awaits until the main app element is found in DOM and returns it
 * @returns {Promise<HTMLElement>}
 */
async function waitForApp() {
	const getAppEl = (parent) => parent.querySelector('.App');
	let appEl = getAppEl(document.body);

	if (appEl) return appEl;

	return new Promise((resolve) => {
		new MutationObserver((_, me) => {
			appEl = getAppEl(document.body);
			if (appEl) {
				me.disconnect();
				resolve(appEl);
			}
		}).observe(document.body, { subtree: true, childList: true });
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
	await once(window, 'load');
	const appEl = await waitForApp();

	const pageCheckCallback = () => {
		if (['/app/likes-you', '/app/gold-home'].includes(location.pathname)) {
			console.debug('[TINDER DEBLUR]: Deblurring likes');
			unblur();
		}
	};

	// setup navigation observer
	const observer = new MutationObserver(pageCheckCallback);
	observer.observe(appEl, { subtree: true, childList: true });

	// setup loop based observer (every 5s)
	setInterval(pageCheckCallback, 5000);
}
main().catch(console.error);
