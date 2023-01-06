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

Initially, Tinder API returned clean profile images on requests that had their headers stripped down. Recently Tinder patched this exploit for the web app. However, they did not patch it for their Android API. So that's what this script is using now.

Also, the match's profile image URLs can be reconstructed with metadata provided by the matches endpoint.

The fact that it has been working for at least 3 years now is actually quite unexpected. **Be prepared** for this exploit to be patched sooner or later.

## Contributors

<a href="https://github.com/tajnymag/tinder-deblur/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tajnymag/tinder-deblur" />
</a>
