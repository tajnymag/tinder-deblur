# tinder-deblur
 Simple script using the official Tinder API to get clean photos of the users who liked you

## How to use

1. install a userscript manager ([Violentmonkey](https://violentmonkey.github.io/), [Tampermonkey](https://www.tampermonkey.net/), [Greasemonkey](https://www.greasespot.net/), ...)
2. install the script:
    * either click [this link](https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js) and the manager will install the script for you
    * or copy the URL below and install it manually through manager's UI
    `https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js`
3. browse the Tinder web app normally and the profiles that like you should be unblurred

## How does it work

Tinder API returns clean profile images on requests that have their headers stripped down. The fact that it has been working for at least 2 years now is actually quite unexpected. **Be prepared** for this exploit to be patched sooner or later.
