// ==UserScript==
// @name        Tinder Deblur
// @namespace   Violentmonkey Scripts
// @match       https://tinder.com/*
// @grant       none
// @version     4.1
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

		this.photoIndex = 0;
	}

	/**
	 * @returns {string}
	 */
	getPreviousPhoto() {
		this.photoIndex = this.photoIndex - 1;

		if (this.photoIndex < 0) this.photoIndex = this.user.photos.length - 1;

		return this.user.photos[this.photoIndex].url;
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

		this.cache.delete(userId);
	}

	clear() {
		for (const userItem of this.cache.values()) {
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

		if (!teaserEl) continue;

		const likeEl = teaserEl.parentElement?.parentElement;

		if (!likeEl) continue;

		if (teaserImage.includes('unknown') || !teaserImage.includes('images-ssl')) {
			if(likeEl.dataset.errorText)
				continue;

			likeEl.dataset.errorText = 'true';
			likeEl.firstChild.style.opacity = '0.5';
			likeEl.innerHTML += `
				<div class="error-text" style="position: absolute; display: flex; justify-content: center; top: 5px; left: 5px; width: calc(100% - 5px * 2);">
					<p style="text-align: center; background-color: #0008; padding: 4px 12px; border-radius: 12.5px; color: #ac0c04; text-transform: uppercase; font-size: 14px;">Invalid</p>
				</div>
			`;
			continue;
		}

		if (likeEl.dataset.errorText) {
			likeEl.dataset.removeProperty("errorText");
			likeEl.querySelector(".error-text").remove();
			likeEl.firstChild.opacity = 1;
		}

		const userId = teaserImage.slice(32, 56);

		if (cache.has(userId)) continue;

		try {
			if (likeEl.dataset.userId) continue;

			likeEl.style.opacity = '0';

			fetchUser(userId).then((user) => {
				if (!user) {
					console.error(`Could not load user '${userId}'`);
					return;
				}

				// log user name + bio
				console.debug(`${user.name} (${user.bio})`);

				const infoContainerEl = teaserEl.parentElement?.lastElementChild;

				if (!infoContainerEl) {
					console.error(`Could not find info container for '${userId}'`);
					return;
				}

				// save user to cache
				const userItem = cache.add(userId, user);

				// hide the like if it was passed before
				if (userItem.isHidden()) {
					teaserEl.parentNode?.parentElement?.remove();
					return;
				}

				likeEl.dataset.userId = userId;
				likeEl.classList.add('like-item');

				// update info container
				infoContainerEl.outerHTML = `
					<div class='Pos(a) Start(0) End(0) TranslateZ(0) Pe(n) B(0)' style='background-image: linear-gradient(to top, #000F 0%, #0000 100%); height: 65%;'>
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
						<!-- Distance -->
						<div class="D(f) Row Typs(body-1-regular)" style="transform: translateY(-20px);">
							<div class="D(ib) Va(t)">
							<svg focusable="false" aria-hidden="true" role="presentation" viewBox="0 0 24 24" width="24px" height="24px" class="Va(m) Sq(16px)">
								<g fill="#fff" stroke="#fff" stroke-width=".5" fill-rule="evenodd">
								<path d="M11.436 21.17l-.185-.165a35.36 35.36 0 0 1-3.615-3.801C5.222 14.244 4 11.658 4 9.524 4 5.305 7.267 2 11.436 2c4.168 0 7.437 3.305 7.437 7.524 0 4.903-6.953 11.214-7.237 11.48l-.2.167zm0-18.683c-3.869 0-6.9 3.091-6.9 7.037 0 4.401 5.771 9.927 6.897 10.972 1.12-1.054 6.902-6.694 6.902-10.95.001-3.968-3.03-7.059-6.9-7.059h.001z" />
								<path d="M11.445 12.5a2.945 2.945 0 0 1-2.721-1.855 3.04 3.04 0 0 1 .641-3.269 2.905 2.905 0 0 1 3.213-.645 3.003 3.003 0 0 1 1.813 2.776c-.006 1.653-1.322 2.991-2.946 2.993zm0-5.544c-1.378 0-2.496 1.139-2.498 2.542 0 1.404 1.115 2.544 2.495 2.546a2.52 2.52 0 0 0 2.502-2.535 2.527 2.527 0 0 0-2.499-2.545v-.008z" />
								</g>
							</svg>
							</div>
							<div class="Us(t) Va(m) D(ib) NetWidth(100%,24px) C($c-ds-text-primary-overlay) Ell">
							${user.distance_mi} miles away
							</div>
						</div>
						<!-- Bio -->
						<span class='like-user-bio' style='-webkit-box-orient: vertical; display: -webkit-box; -webkit-line-clamp: 3; max-height: 63px; overflow-y: hidden; text-overflow: ellipsis; transform: translateY(-20px);'>${user.bio}</span>
						</div>
						</div>
					</div>
				`;

				// deblur
				teaserEl.id = 'teaser-' + userId;
				teaserEl.classList.add('teaser', 'like-action-button', 'like-action-next-photo');
				teaserEl.style.backgroundSize = 'cover';
				teaserEl.style.backgroundImage = `url(${user.photos[0].url})`;
			});
		} catch (err) {
			if (err.name != 'SyntaxError') console.error(`Failed to load user '${userId}': ${err.name}`);
		}
	}
}

/**
 * Remove Tinder Gold ads
 */
function removeGoldAds() {
	// hide special offer advertisement
	const advertisementLogo = document.querySelector('div[aria-label="Tinder Gold"]');

	if (advertisementLogo) {
		const addContainer = advertisementLogo.parentElement?.parentElement;

		if (addContainer) addContainer.style.display = 'none';
	}

	// remove 'Tinder Gold' advertisement

	for (const advertisementEl of document.getElementsByTagName('div')) {
		if (advertisementEl.children.length > 0) continue;

		if (advertisementEl.innerText.toLowerCase().includes('gold')) {
			advertisementEl.remove();
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

	if (!likesGridContainerEl) return;

	// fix scrolling
	if (likesGridContainerEl.parentElement) likesGridContainerEl.parentElement.style.overflow = 'hidden';

	if (!likesGridContainerEl.dataset.eventsInterrupted) {
		likesGridContainerEl.dataset.eventsInterrupted = 'true';
		likesGridContainerEl.addEventListener('scroll', (event) => event.stopImmediatePropagation(), true);
		likesGridContainerEl.style.justifyContent = 'flex-start';
	}

	// update the likes grid
	const likesGridEl = likesGridContainerEl.lastElementChild;

	if (!(likesGridEl instanceof HTMLElement)) return;

	if (!likesGridEl.dataset.stylesUpdated) {
		likesGridEl.dataset.stylesUpdated = 'true';
		likesGridEl.classList.add('D(f)');
		likesGridEl.style.removeProperty('height');
		likesGridEl.style.flexWrap = 'wrap';
		likesGridEl.style.flex = 'unset';
		likesGridEl.style.gap = '10px';
		likesGridEl.style.justifyContent = 'flex-start';
	}

	// update the like elements
	for (const likeEl of likesGridEl.children) {
		if (!(likeEl instanceof HTMLElement)) {
			continue;
		}

		/** @type {HTMLElement | null} */
		const infoContainerEl = likeEl.querySelector('.like-user-info');

		if (!infoContainerEl) continue;

		/** @type {HTMLElement | null} */
		const userNameEl = infoContainerEl.querySelector('.like-user-name');
		/** @type {HTMLElement | null} */
		const userBioEl = infoContainerEl.querySelector('.like-user-bio');

		if (!userNameEl || !userBioEl) continue;

		// don't update the element if it is invisible
		if (likeEl.style.display === 'none') continue;

		const userId = likeEl.dataset.userId;

		if (!userId) continue;

		const userItem = cache.get(userId);

		if (!userItem) continue;

		const user = userItem.user;
		const teaserEl = document.getElementById(`teaser-${userId}`);

		if (!teaserEl) continue;

		// only update if user was loaded
		if (!userId) continue;

		// only update the container once
		if (likeEl.dataset.infoSet) continue;

		likeEl.dataset.infoSet = 'true';

		// classes
		likeEl.classList.remove('Cur(p)');

		// styles
		likeEl.style.removeProperty('transform');
		likeEl.style.position = 'relative';
		likeEl.style.backgroundColor = 'black';
		likeEl.style.borderRadius = '8px';
		likeEl.style.marginTop = '0';
		likeEl.style.marginBottom = '0';

		// update info container

		const userBioElHeight = userBioEl.getBoundingClientRect().height;

		userNameEl.style.transform = `translateY(-${userBioElHeight + 20 /* distance height */ + 20 /* name height */ + 20 /* action buttons */}px)`;
		infoContainerEl.style.opacity = `1`;

		// add action buttons
		likeEl.innerHTML += `
			<div class='like-actions' style='align-items: center; background-image: linear-gradient(to top, #0004, #0001); border-radius: 8px; display: flex; height: 30px; justify-content: space-around; left: 5px; padding: 2px; position: absolute; bottom: 5px; width: calc(100% - 5px * 2);'>
				<!-- Hide -->
				<button class='like-action-button like-action-pass button Lts($ls-s) Cur(p) Tt(u) Bdrs(50%) P(0) Fw($semibold) focus-button-style Bxsh($bxsh-btn) Wc($transform) Pe(a) Scale(1.1):h Scale(.9):a' type='button' style='cursor: pointer; height: 24px; width: 24px;' draggable='false'>
				<span class='Pos(r) Z(1) Expand'>
				<span class='D(b) Expand' style='transform: scale(1); filter: none;'>
				<svg focusable='false' aria-hidden='true' role='presentation' viewBox='0 0 24 24' width='24px' height='24px' class='Scale(.75) Expand'>
					<path d='m15.44 12 4.768 4.708c1.056.977 1.056 2.441 0 3.499-.813 1.057-2.438 1.057-3.413 0L12 15.52l-4.713 4.605c-.975 1.058-2.438 1.058-3.495 0-1.056-.813-1.056-2.44 0-3.417L8.47 12 3.874 7.271c-1.138-.976-1.138-2.44 0-3.417a1.973 1.973 0 0 1 3.25 0L12 8.421l4.713-4.567c.975-1.139 2.438-1.139 3.413 0 1.057.814 1.057 2.44 0 3.417L15.44 12Z' fill='var(--fill--background-nope, none)' />
				</svg>
				</span>
				</span>
				</button>
				<!-- Like -->
				<button class='like-action-button like-action-like button Lts($ls-s) Cur(p) Tt(u) Bdrs(50%) P(0) Fw($semibold) focus-button-style Bxsh($bxsh-btn) Wc($transform) Pe(a) Scale(1.1):h Scale(.9):a' type='button' style='cursor: pointer; height: 24px; width: 24px;' draggable='false'>
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

		// add photo selector
		const photoSelectorContainer = document.createElement('div');
		photoSelectorContainer.setAttribute('class', 'photo-selectors CenterAlign D(f) Fxd(r) W(100%) Px(8px) Pos(a) Iso(i)');
		photoSelectorContainer.style.top = '5px';
		likeEl.appendChild(photoSelectorContainer);

		for (let i = 0; i < user.photos.length; i++) {
			const photo = user.photos[i];
			const photoButton = document.createElement('button');
			photoButton.setAttribute('class', 'like-action-button like-action-photo bullet D(ib) Va(m) Cnt($blank)::a D(b)::a Cur(p) H(4px)::a W(100%)::a Py(4px) Px(2px) W(100%) Bdrs(100px)::a focus-background-style ' + (i == 0 ? 'Bgc($c-ds-background-tappy-indicator-active)::a bullet--active' : 'Bgc($c-ds-background-tappy-indicator-inactive)::a'));
			photoButton.dataset.photoIndex = i.toString();
			photoSelectorContainer.appendChild(photoButton);
		}

		// handle like element click
		likeEl.addEventListener(
			'click',
			(event) => {
				if (!(event.target instanceof HTMLElement)) return;

				/** @type {HTMLElement | null} */
				let currentParent = event.target;

				if (!currentParent) return;

				while (!currentParent?.classList.contains('like-action-button')) {
					if (!currentParent?.parentElement) break;
					currentParent = currentParent.parentElement;
				}

				event.stopImmediatePropagation();

				if (!currentParent) return;

				if (currentParent.classList.contains('like-action-pass')) {
					pass(userItem);
				} else if (currentParent.classList.contains('like-action-like')) {
					like(userItem);
				} else {
					if (currentParent.classList.contains('like-action-photo')) {
						const index = parseInt(currentParent.dataset.photoIndex ?? '0');
						showPhoto(likeEl, userItem.photoIndex, index, user.photos[index].url);
						userItem.photoIndex = index;
					} else if (currentParent.classList.contains('like-action-next-photo')) {
						const oldIndex = userItem.photoIndex;
						const photoUrl = event.offsetX < currentParent.clientWidth / 2 ? userItem.getPreviousPhoto() : userItem.getNextPhoto();
						showPhoto(likeEl, oldIndex, userItem.photoIndex, photoUrl);
					}

					return;
				}

				likeEl.remove();
			},
			true
		);

		// like element is now complete
		likeEl.style.transition = 'opacity 0.4s ease-out';
		likeEl.style.opacity = '1';
	}
}

/**
 * Updates the photo
 * @param {HTMLElement} likeEl
 * @param {number} oldIndex
 * @param {number} index
 * @param {string} photoUrl
 */
function showPhoto(likeEl, oldIndex, index, photoUrl) {
	/** @type {HTMLElement | null} */
	const teaserEl = likeEl.querySelector('.teaser');
	const photoSelectorContainer = likeEl.querySelector('.photo-selectors');

	if (!photoSelectorContainer) return;

	const oldPhotoButton = photoSelectorContainer.children[oldIndex];
	oldPhotoButton.classList.remove('Bgc($c-ds-background-tappy-indicator-active)::a');
	oldPhotoButton.classList.remove('bullet--active');
	oldPhotoButton.classList.add('Bgc($c-ds-background-tappy-indicator-inactive)::a');

	if (!teaserEl) return;

	teaserEl.style.backgroundImage = `url('${photoUrl}')`;

	const newPhotoButton = photoSelectorContainer.children[index];
	newPhotoButton.classList.remove('Bgc($c-ds-background-tappy-indicator-inactive)::a');
	newPhotoButton.classList.add('Bgc($c-ds-background-tappy-indicator-active)::a');
	newPhotoButton.classList.add('bullet--active');
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
					// remove "show all" button
					for (const element of document.querySelectorAll('div[role="dialog"] .menuItem__contents > div > div[role="button"]')) {
						element.remove();
					}

					const applyContainer = document.querySelector('div[role="dialog"] > div:not(.menuItem):not(.CenterAlign)');

					if (applyContainer != null) {
						applyContainer.innerHTML = '';
						applyContainer.className = '';
						applyContainer.setAttribute('style', 'align-items: center; display: flex; flex-shrink: 0; font-size: 20px; height: 50px; justify-content: center; width: 100%;');

						const applyButtonEl = document.createElement('button');
						applyButtonEl.innerText = 'Apply';
						applyButtonEl.style.textTransform = 'uppercase';
						applyButtonEl.style.fontWeight = '600';
						applyButtonEl.style.color = 'var(--color--text-brand-normal)';
						applyContainer.appendChild(applyButtonEl);

						applyButtonEl.addEventListener(
							'click',
							(event) => {
								event.stopImmediatePropagation();

								const dialogMenuItemContents = document.querySelectorAll('div[role="dialog"] > .menuItem > .menuItem__contents > div:nth-of-type(2)');

								// max distance
								const maxDistanceElement = dialogMenuItemContents[0].querySelector('div[style]');

								if (!maxDistanceElement) return;

								const maxDistance = Math.floor((maxDistanceElement.clientWidth / (maxDistanceElement.parentElement?.clientWidth ?? 1)) * (161 - 2) + 2);

								if (maxDistance == 161) maxDistance = Number.MAX_SAFE_INTEGER;

								// age range
								const ageRangeElement = dialogMenuItemContents[1].querySelector('div[style]');

								if (!ageRangeElement) return;

								const ageRangeStart = Math.round((parseFloat(getComputedStyle(ageRangeElement).left.replace('px', '')) / (ageRangeElement.parentElement?.clientWidth ?? 1)) * (100 - 18) + 18);
								let ageRangeEnd = ageRangeStart + Math.round((ageRangeElement.clientWidth / (ageRangeElement.parentElement?.clientWidth ?? 1)) * (100 - 18));

								if (ageRangeEnd == 100) ageRangeEnd = Number.MAX_SAFE_INTEGER;

								// minimum photos amount
								let minimumPhotosAmount = 0;

								/** @type {NodeListOf<HTMLDivElement>} */
								const photosOptions = dialogMenuItemContents[2].querySelectorAll('div[role="option"]');

								for (const minimumPhotosOption of photosOptions) {
									if (minimumPhotosOption.getAttribute('class')?.includes('c-ds-border-passions-shared')) {
										minimumPhotosAmount = parseInt(minimumPhotosOption.innerText);
										break;
									}
								}

								// interests
								const interests = [];

								/** @type {NodeListOf<HTMLDivElement>} */
								const interestOptions = dialogMenuItemContents[3].querySelectorAll('div[role="option"]');

								for (const interestOption of interestOptions) {
									if (interestOption.getAttribute('class')?.includes('c-ds-border-passions-shared')) interests.push(interestOption.innerText);
								}

								/** @type {NodeListOf<HTMLInputElement>} */
								const dialogMenuSelects = document.querySelectorAll('div[role="dialog"] > .menuItem > .menuItem__contents .menuItem__select input');

								// verified
								const verifiedRequired = dialogMenuSelects[0].checked;

								// has bio
								const bioRequired = dialogMenuSelects[1].checked;

								// apply filter
								/** @type {NodeListOf<HTMLDivElement>} */
								const likeItems = document.querySelectorAll('.like-item');

								for (const likeElement of likeItems) {
									if (!likeElement.dataset.userId) continue;

									const userItem = cache.get(likeElement.dataset.userId);

									if (!userItem) continue;

									const user = userItem.user;
									const userInterests = Array.from(user.user_interests ?? []).map((interest) => interest.name);

									let matches = true;

									// check radius
									if (!user.hide_distance && user.distance_mi > maxDistance) matches = false;
									// check age range
									else if (!user.hide_age && (userItem.getAge() < ageRangeStart || userItem.getAge() > ageRangeEnd)) matches = false;
									// check photos amount
									else if (user.photos.length < minimumPhotosAmount) matches = false;
									// check verified
									else if (!user.is_tinder_u && verifiedRequired) matches = false;
									// check bio
									else if (user.bio.length == 0 && bioRequired) matches = false;
									// check interests
									else {
										for (const interest of interests) {
											if (!userInterests.includes(interest)) matches = false;
										}
									}

									likeElement.style.display = matches ? 'flex' : 'none';
								}

								// close dialog
								/** @type {Element | null | undefined} */
								const applyButton = document.querySelector('div[role="dialog"]')?.parentElement?.firstElementChild;

								if (applyButton instanceof HTMLElement) applyButton?.click();

								setTimeout(removeGoldAds, 250);
							},
							true
						);
					}
				}, 200);
			});
		}

		if (!filterButtonEl.parentElement) return;

		/** @type {NodeListOf<HTMLDivElement>} */
		const optionEls = filterButtonEl.parentElement.querySelectorAll('div[role="option"]');

		for (const optionEl of optionEls) {
			if (!optionEl.dataset.eventsInterrupted) optionEl.remove();
		}

		if (!filterButtonEl.parentElement.parentElement) return;

		/** @type {HTMLElement} */
		const filterButtonContainer = filterButtonEl.parentElement.parentElement;
		filterButtonContainer.style.maxWidth = 'calc(100% - 36.5px * 2 + 12px * 2)';
	}
}

/**
 * Passes a user and hides it from the likes section afterwards
 * @param {UserCacheItem} userItem
 */
async function pass(userItem) {
	const response = await fetch(`https://api.gotinder.com/pass/${userItem.userId}?s_number=${userItem.user.s_number}`, {
		headers: {
			'X-Auth-Token': localStorage.getItem('TinderWeb/APIToken') ?? '',
			platform: 'android',
		},
		method: 'GET',
	});

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
		console.warn('[TINDER DEBLUR]: The only supported way of running this script is through a userscript management browser addons like Violentmonkey, Tampermonkey or Greasemonkey!');
		console.warn('[TINDER DEBLUR]: Script was not terminated, but you should really look into the correct way of running it.');
	}

	// wait for a full page load
	await once(window, 'load');
	const appEl = await waitForApp();

	const pageCheckCallback = async () => {
		if (['/app/likes-you', '/app/gold-home'].includes(location.pathname)) {
			// check if any likes were loaded yet
			if (document.querySelectorAll('div.focus-button-style[style]').length > 0) {
				console.debug('[TINDER DEBLUR]: Removing Tinder Gold ads');
				removeGoldAds();

				console.debug('[TINDER DEBLUR]: Checking filters');
				updateUserFiltering();

				console.debug('[TINDER DEBLUR]: Deblurring likes');
				await unblur();

				console.debug('[TINDER DEBLUR]: Updating user infos');
				updateUserInfos();
			}
		} else {
			// clear the cache when not on likes page anymore
			cache.clear();
		}

		// loop based observer (every 5s)
		setTimeout(pageCheckCallback, 5_000);
	};

	pageCheckCallback();
}

main().catch(console.error);
