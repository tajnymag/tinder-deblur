// ==UserScript==
// @name        Tinder Deblur
// @namespace   Violentmonkey Scripts
// @match       https://tinder.com/*
// @grant       none
// @version     2.8
// @author      Tajnymag
// @downloadURL https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js
// @description Simple script using the official Tinder API to get clean photos of the users who liked you
// ==/UserScript==

// enable type checking
// @ts-check
// @filename: types/tampermonkey.d.ts

const cache = new Set();
const photoIntervals = new Set();

/**
 * Core logic of the script
 */
async function unblur() {
	const teasers = await fetchTeasers();
	/** @type {NodeListOf<HTMLElement>} */
	const teaserEls = document.querySelectorAll('.Expand.enterAnimationContainer > div:nth-child(1)');

	for (let i = 0; i < teaserEls.length; ++i) {
		const teaser = teasers[i];
		const teaserEl = teaserEls[i];
		const teaserImage = teaser.user.photos[0].url;

		if (teaserImage.includes('unknown')) continue;

		if (teaserImage.includes('images-ssl')) {
			const userId = teaserImage.slice(32, 56);

			if (cache.has(userId)) continue;

			try {
				const user = await fetchUser(userId);

				if (!user) {
					console.debug(`Could not load user '${userId}'`);
					continue;
				}

				cache.add(userId);

				// log user info + photos
				console.debug(`${user.name} (${user.bio})`);

				const photos = [];
				for (let photo of user.photos) {
					photos.push(photo.url);
				}

				// update info container
				const infoContainer = teaserEl.parentNode?.lastElementChild;

				if (!infoContainer) {
					console.debug(`Could not find info container for '${userId}'`);
					continue;
				}

				infoContainer.outerHTML = `
					<div class="Pos(a) Start(0) End(0) TranslateZ(0) Pe(n) H(30%) B(0)" style="background-image: linear-gradient(to top, rgb(0, 0, 0) 0%, rgba(255, 255, 255, 0) 100%);"></div>
						<div style="opacity: 0; transition: opacity 0.5s ease-out;" class="like-user-info Pos(a) D(f) Jc(sb) C($c-ds-text-primary-overlay) Ta(start) W(100%) Ai(fe) B(0) P(8px)--xs P(16px) P(20px)--l Cur(p) focus-button-style" tabindex="0">
							<div class="Tsh($tsh-s) D(f) Fx($flx1) Fxd(c) Miw(0)">
								<div class="Pos(a) Fz($l) B(0) Trsdu($fast) Maw(80%) D(f) Fxd(c) like-user-name">
									<div class="D(f) Ai(c) Miw(0)">
										<div class="Ov(h) Ws(nw) As(b) Ell">
											<span class="Typs(display-2-strong)" itemprop="name">${user.name}</span>
										</div>
										<span class="As(b) Pend(8px)"></span>
										<span class="As(b)" itemprop="age">${
											user.birth_date
												? new Date().getFullYear() -
												  new Date(Date.parse(user.birth_date)).getFullYear()
												: ''
										}</span>
									</div>
								</div>
							<div class="Animn($anim-slide-in-left) Animdur($fast)">
								<span class="like-user-bio">${user.bio}</span>
							</div>
						</div>
					</div>
				`;

				// switch images automatically
				let currentPhotoIndex = 0;

				photoIntervals.add(
					setInterval(() => {
						teaserEl.style.backgroundImage = `url(${photos[currentPhotoIndex % photos.length]})`;
						currentPhotoIndex++;
					}, 2_500)
				);
			} catch (ignore) {}
		}
	}

	// update user infos
	setTimeout(() => {
		/** @type {NodeListOf<HTMLElement>} */
		const infoContainerEls = document.querySelectorAll('.like-user-info');

		for (let infoContainerEl of infoContainerEls) {
			/** @type {HTMLElement | null} */
			const userNameEl = infoContainerEl.querySelector('.like-user-name');
			/** @type {HTMLElement | null} */
			const userBioEl = infoContainerEl.querySelector('.like-user-bio');

			if (!userNameEl || !userBioEl) continue;

			const userBioElHeight = userBioEl.getBoundingClientRect().height;

			userNameEl.style.transform = `translateY(-${userBioElHeight + 20}px)`;
			infoContainerEl.style.opacity = `1`;
		}
	}, 2_500);
}

/**
 * Fetches teaser cards using Tinder API
 * @returns {Promise<any>}
 */
async function fetchTeasers() {
	return fetch('https://api.gotinder.com/v2/fast-match/teasers', {
		headers: {
			'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken') ?? '',
			platform: 'android',
		},
	})
		.then((res) => res.json())
		.then((res) => res.data.results)
		.catch((ignore) => {});
}

/**
 * Fetches information about specific user using Tinder API
 * @param {string} id
 * @returns {Promise<any>}
 */
async function fetchUser(id) {
	return fetch(`https://api.gotinder.com/user/${id}`, {
		headers: {
			'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken') ?? '',
			platform: 'android',
		},
	})
		.then((res) => res.json())
		.then((res) => res.results)
		.catch((ignore) => {});
}

/**
 * Awaits the first event of the specified listener
 * @param {EventTarget} target
 * @param {string} eventType
 * @returns {Promise<void>}
 */
async function once(target, eventType) {
	return new Promise((resolve) => {
		const resolver = () => {
			target.removeEventListener(eventType, resolver);
			resolve();
		};
		target.addEventListener(eventType, resolver);
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
		} else {
			cache.clear();

			for (const intervalId of photoIntervals) {
				clearInterval(intervalId);
				photoIntervals.delete(intervalId);
			}
		}
	};

	// setup navigation observer
	const observer = new MutationObserver(pageCheckCallback);
	observer.observe(appEl, { subtree: true, childList: true });

	// setup loop based observer (every 5s)
	setInterval(pageCheckCallback, 5_000);
}

main().catch(console.error);
