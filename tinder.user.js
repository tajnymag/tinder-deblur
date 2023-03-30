// ==UserScript==
// @name        Tinder Deblur
// @namespace   Violentmonkey Scripts
// @match       https://tinder.com/*
// @grant       none
// @version     4.0b
// @author      Tajnymag
// @downloadURL https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js
// @description Simple script using the official Tinder API to get clean photos of the users who liked you
// ==/UserScript==

// enable type checking
// @ts-check
// @filename: types/tampermonkey.d.ts

class UserCacheItem {
	/**
	 * @param {string} userId
	 * @param {object} user
	 */
	constructor(userId, user) {
		this.userId = userId;
		this.user = user;
		this.hidden = !!localStorage.getItem('hiddenUsers')?.includes(userId);

		this.updater = null;
		this.photoIndex = 0;
	}

	/**
	 * @returns {string}
	 */
	getNextPhoto() {
		this.photoIndex = (this.photoIndex + 1) % this.user.photos.length;

		return this.user.photos[this.photoIndex].url;
	}

	/**
	 * @returns {number}
	 */
	getAge() {
		if (!this.user.birth_date) return 0;

		const currentYear = new Date().getFullYear();
		const birthDate = Date.parse(this.user.birth_date);
		const birthYear = new Date(birthDate).getFullYear();

		return currentYear - birthYear;
	}

	/** @param {number} interval */
	setUpdater(interval) {
		this.clearUpdater();
		this.updater = interval;
	}

	clearUpdater() {
		if (!this.updater) return;
		clearInterval(this.updater);
	}

	/**
	 * @returns {boolean}
	 */
	isHidden() {
		return this.hidden;
	}

	/** @param {boolean} hidden */
	setHidden(hidden) {
		this.hidden = hidden;
	}
}

class UserCache {
	constructor() {
		/** @type {Map<string, UserCacheItem>} */
		this.cache = new Map();
	}

	/**
	 * @param {string} userId
	 * @param {object} user
	 * @returns {UserCacheItem}
	 */
	add(userId, user) {
		this.delete(userId);

		const newItem = new UserCacheItem(userId, user);
		this.cache.set(userId, newItem);

		return newItem;
	}

	/**
	 * @param {string} userId
	 */
	has(userId) {
		return this.cache.has(userId);
	}

	/**
	 * @param {string} userId
	 * @returns UserCacheItem | undefined
	 */
	get(userId) {
		return this.cache.get(userId);
	}

	/**
	 * @param {string} userId
	 */
	delete(userId) {
		const existingUser = this.cache.get(userId);

		if (!existingUser) return;

		existingUser.clearUpdater();
		this.cache.delete(userId);
	}

	clear() {
		for (const userItem of this.cache.values()) {
			userItem.clearUpdater();
			this.cache.delete(userItem.userId);
		}
	}
}

/**
 * Holds a persistent cache of fetched users and intervals for updating their photos
 */
const cache = new UserCache();

/**
 * Original function of the script
 */
async function unblur() {
	const [failedToFetchTeasersError, teasers] = await safeAwait(fetchTeasers());

	if (failedToFetchTeasersError) {
		console.error(`Could not load teasers: ${failedToFetchTeasersError.name}`);
		return;
	}

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
					console.error(`Could not load user '${userId}'`);
					continue;
				}

				// save user to cache
				const userItem = cache.add(userId, user);

				// hide the like if it was passed before
				if (userItem.isHidden()) {
					teaserEl.parentNode?.parentElement?.remove();
					continue;
				}

				// log user name + bio
				console.debug(`${user.name} (${user.bio})`);

				const infoContainerEl = teaserEl.parentElement?.lastElementChild;

				if (!infoContainerEl) {
					console.error(`Could not find info container for '${userId}'`);
					continue;
				}

				if (teaserEl.parentElement.parentElement) {
					teaserEl.parentElement.parentElement.dataset.userId = userId;
				}

				// update info container
				infoContainerEl.outerHTML = `
		<div class='Pos(a) Start(0) End(0) TranslateZ(0) Pe(n) H(30%) B(0)' style='background-image: linear-gradient(to top, rgb(0, 0, 0) 0%, rgba(255, 255, 255, 0) 100%);'>
		  <div style='opacity: 0; transition: opacity 0.5s ease-out;' class='like-user-info Pos(a) D(f) Jc(sb) C($c-ds-text-primary-overlay) Ta(start) W(100%) Ai(fe) B(0) P(8px)--xs P(16px) P(20px)--l Cur(p) focus-button-style' tabindex='0'>
			<div class='Tsh($tsh-s) D(f) Fx($flx1) Fxd(c) Miw(0)'>
			  <div class='Pos(a) Fz($l) B(0) Trsdu($fast) Maw(80%) D(f) Fxd(c) like-user-name'>
				<div class='D(f) Ai(c) Miw(0)'>
				  <!-- Name -->
				  <div class='Ov(h) Ws(nw) As(b) Ell'>
					<span class='Typs(display-2-strong)' itemprop='name'>${user.name}</span>
				  </div>
				  <span class='As(b) Pend(8px)'></span>
				  <!-- Age -->
				  <span class='As(b)' itemprop='age'>${userItem.getAge()}</span>
				</div>
			  </div>
			  <!-- Bio -->
			  <span class='like-user-bio' style='-webkit-box-orient: vertical; display: -webkit-box; -webkit-line-clamp: 3; max-height: 63px; overflow-y: hidden; text-overflow: ellipsis;'>${
					user.bio
				}</span>
			</div>
		  </div>
		</div>
	  `;

				// switch images automatically
				userItem.setUpdater(
					setInterval(() => {
						teaserEl.style.backgroundImage = `url(${userItem.getNextPhoto()})`;
					}, 2_500)
				);
			} catch (err) {
				console.error(`Failed to load user '${userId}': ${err.name}`);
			}
		}
	}
}

/**
 * Remove Tinder Gold ads
 */
function removeGoldAds() {
	// remove 'Tinder Gold' advertisement
	/** @type {NodeListOf<HTMLDivElement>} */
	const advertisementEls = document.querySelectorAll('div[style] > div');
	for (const advertisementEl of advertisementEls) {
		if (advertisementEl.innerText.toLowerCase().includes('gold')) {
			advertisementEl.remove();
			break;
		}
	}

	// remove gold button
	/** @type {HTMLButtonElement | null} */
	const goldButtonEl = document.querySelector('div.CenterAlign button[type="button"]');

	if (goldButtonEl != null) goldButtonEl.remove();
}

function updateUserInfos() {
	/** @type {HTMLElement | null} */
	const likesGridContainerEl = document.querySelector('main div.Expand > div[role="grid"]');

	if (!likesGridContainerEl) {
		return;
	}

	// fix scrolling
	if (likesGridContainerEl.parentElement) {
		likesGridContainerEl.parentElement.style.overflow = 'hidden';
	}

	if (!likesGridContainerEl.dataset.eventsInterrupted) {
		likesGridContainerEl.dataset.eventsInterrupted = 'true';
		likesGridContainerEl.addEventListener('scroll', (event) => event.stopImmediatePropagation(), true);
		likesGridContainerEl.style.justifyContent = 'flex-start';
	}

	// update the likes grid
	const likesGridEl = likesGridContainerEl.lastElementChild;

	if (!(likesGridEl instanceof HTMLElement)) {
		return;
	}

	likesGridEl.classList.add('D(f)');
	likesGridEl.style.removeProperty('height');
	likesGridEl.style.flexWrap = 'wrap';
	likesGridEl.style.gap = '5px';

	for (const likeEl of likesGridEl.children) {
		// classes
		likeEl.classList.remove('Cur(p)');

		if (!(likeEl instanceof HTMLElement)) {
			return;
		}

		// styles
		likeEl.style.removeProperty('transform');
		likeEl.style.position = 'relative';
		likeEl.style.backgroundColor = 'black';
		likeEl.style.borderRadius = '8px';
		likeEl.style.marginTop = '0';
		likeEl.style.marginBottom = '0';
	}

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

		// add action buttons

		/** @type {HTMLElement | null | undefined} */
		const likeEl = infoContainerEl.parentNode?.parentElement?.parentElement;

		if (!likeEl) return;

		if (!likeEl.dataset.eventsInterrupted) {
			likeEl.dataset.eventsInterrupted = 'true';
			likeEl.innerHTML += `
	<div class='like-actions' style='align-items: center; background-color: #0002; border-radius: 8px; display: flex; justify-content: space-around; left: 5px; padding: 2px; position: absolute; top: 5px; width: calc(100% - 5px * 2);'>
	  <!-- Hide -->
	  <button class='like-action-pass button Lts($ls-s) Cur(p) Tt(u) Bdrs(50%) P(0) Fw($semibold) focus-button-style Bxsh($bxsh-btn) Wc($transform) Pe(a) Scale(1.1):h Scale(.9):a' type='button' style='cursor: pointer; height: 30px; width: 30px;' draggable='false'>
		<span class='Pos(r) Z(1) Expand'>
		  <span class='D(b) Expand' style='transform: scale(1); filter: none;'>
			<svg focusable='false' aria-hidden='true' role='presentation' viewBox='0 0 24 24' width='24px' height='24px' class='Scale(.75) Expand'>
			  <path d='m15.44 12 4.768 4.708c1.056.977 1.056 2.441 0 3.499-.813 1.057-2.438 1.057-3.413 0L12 15.52l-4.713 4.605c-.975 1.058-2.438 1.058-3.495 0-1.056-.813-1.056-2.44 0-3.417L8.47 12 3.874 7.271c-1.138-.976-1.138-2.44 0-3.417a1.973 1.973 0 0 1 3.25 0L12 8.421l4.713-4.567c.975-1.139 2.438-1.139 3.413 0 1.057.814 1.057 2.44 0 3.417L15.44 12Z' fill='var(--fill--background-nope, none)' />
			</svg>
		  </span>
		</span>
	  </button>
	  <!-- Like -->
	  <button class='like-action-like button Lts($ls-s) Cur(p) Tt(u) Bdrs(50%) P(0) Fw($semibold) focus-button-style Bxsh($bxsh-btn) Wc($transform) Pe(a) Scale(1.1):h Scale(.9):a' type='button' style='cursor: pointer; height: 30px; width: 30px;' draggable='false'>
		<span class='Pos(r) Z(1) Expand'>
		  <span class='D(b) Expand' style='transform: scale(1); filter: none;'>
			<svg focusable='false' aria-hidden='true' role='presentation' viewBox='0 0 24 24' width='24px' height='24px' class='Scale(.75) Expand'>
			  <path d='M21.994 10.225c0-3.598-2.395-6.212-5.72-6.212-1.78 0-2.737.647-4.27 2.135C10.463 4.66 9.505 4 7.732 4 4.407 4 2 6.62 2 10.231c0 1.52.537 2.95 1.533 4.076l8.024 7.357c.246.22.647.22.886 0l7.247-6.58.44-.401.162-.182.168-.174a6.152 6.152 0 0 0 1.54-4.09' fill='var(--fill--background-like, none)' />
			</svg>
		  </span>
		</span>
	  </button>
	</div>
  `;

			setTimeout(() => {
				const userId = likeEl.dataset.userId ?? '';

				// handle like element click
				likeEl.addEventListener(
					'click',
					(event) => {
						let currentParent = /** @type {HTMLElement | null} */(event.target);

						if (!currentParent) return;

						// TODO: find a way without an explicit type-cast
						while (currentParent?.tagName.toLowerCase() != 'button') {
							if (!currentParent?.parentElement) break;
							currentParent = currentParent.parentElement;
						}

						likeEl.remove();
						event.stopImmediatePropagation();

						const userItem = cache.get(userId);
						if (!userItem) return;

						if (currentParent.classList.contains('like-action-pass')) {
							pass(userItem);
						} else if (currentParent.classList.contains('like-action-like')) {
							like(userItem);
						}
					},
					true
				);
			}, 500);
		}
	}
}

/**
 * Hides a user from the likes section
 * @param {UserCacheItem} userItem
 */
function hide(userItem) {
	const hiddenUsers = localStorage.getItem('hiddenUsers')?.split(';') ?? [];

	if (!hiddenUsers.includes(userItem.userId)) hiddenUsers.push(userItem.userId);

	localStorage.setItem('hiddenUsers', hiddenUsers.join(';'));

	userItem.hidden = true;
}

/**
 * Adds user filtering
 */
function updateUserFiltering() {
	/** @type {HTMLDivElement | null} */
	const filterButtonEl = document.querySelector('div[role="grid"] div[role="option"]:nth-of-type(1)');

	if (filterButtonEl != null) {
		if (!filterButtonEl.dataset.eventsInterrupted) {
			filterButtonEl.dataset.eventsInterrupted = 'true';
			filterButtonEl.addEventListener('click', (event) => {
				setTimeout(() => {
					const applyButtonEl = document.querySelector(
						'div[role="dialog"] > div button.focus-button-style:nth-of-type(2)'
					);

					if (applyButtonEl != null) {
						applyButtonEl.addEventListener(
							'click',
							(event) => {
								event.stopImmediatePropagation();

								// TODO: filter likes
							},
							true
						);
					}
				}, 1000);
			});
		}
	}

	if (filterButtonEl?.parentElement) {
		/** @type {NodeListOf<HTMLDivElement>} */
		const optionEls = filterButtonEl.parentElement.querySelectorAll('div[role="option]');

		for (const optionEl of optionEls) {
			if (!optionEl.dataset.eventsInterrupted) optionEl.remove();
		}

		if (filterButtonEl.parentElement.parentElement) {
			filterButtonEl.parentElement.parentElement.style.maxWidth = 'calc(100% - 36.5px * 2 + 12px * 2)';
		}
	}
}

/**
 * Passes a user and hides it from the likes section afterwards
 * @param {UserCacheItem} userItem
 */
async function pass(userItem) {
	const response = await fetch(
		`https://api.gotinder.com/pass/${userItem.userId}?s_number=${userItem.user.s_number}`,
		{
			headers: {
				'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken') ?? '',
				platform: 'android',
			},
			method: 'GET',
		}
	);

	hide(userItem);
}

/**
 * Likes a user and hides it from the likes section afterwards
 * @param {UserCacheItem} userItem
 */
async function like(userItem) {
	const response = await fetch(`https://api.gotinder.com/like/${userItem.userId}`, {
		headers: {
			'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken') ?? '',
			platform: 'android',
			'Content-Type': 'application/json',
		},
		method: 'POST',
		body: JSON.stringify({
			liked_content_id: userItem.user.photos[0].id,
			liked_content_type: 'photo',
			s_number: userItem.user.s_number,
		}),
	});

	hide(userItem);
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
		.then((res) => res.data.results);
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
		.then((res) => res.results);
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
 * Utility function to catch errors inline
 * @template T
 * @template {Error} U
 * @param {Promise<T>} promise
 * @return {Promise<[null, T] | [U, undefined]>}
 */
async function safeAwait(promise) {
	try {
		const result = await promise;
		return [null, result];
	} catch (err) {
		return [err, undefined];
	}
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
			console.debug('[TINDER DEBLUR]: Removing Tinder Gold ads')
			removeGoldAds();

			console.debug('[TINDER DEBLUR]: Updating user infos')
			updateUserInfos();

			console.debug('[TINDER DEBLUR]: Checking filters')
			updateUserFiltering();

			console.debug('[TINDER DEBLUR]: Deblurring likes');
			unblur();
		} else {
			// clear the cache when not on likes page anymore
			cache.clear();
		}
	};

	// setup navigation observer
	const observer = new MutationObserver(pageCheckCallback);
	observer.observe(appEl, { subtree: true, childList: true });

	// setup loop based observer (every 5s)
	setInterval(pageCheckCallback, 5_000);
}

main().catch(console.error);
