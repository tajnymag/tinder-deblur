# tinder-deblur
Simple script using the official Tinder API to get clean photos of the users who liked you

## ⚠️DISCLAIMER⚠️

> The project started as a simple wrapper around a javascript function posted on Reddit. I gained way more traction than I anticipated and I couldn't keep up as well and fast as I should have.
> What didn't help, was Tinder patching the exploited bug and later changing both API and frontend's identifiers. With me not on Tinder anymore, I am not able to test possible changes and/or find new exploits.
>
> I am accepting any PRs I get and will do so until the project is archived. If you, the reader, are willing to take over the project, please, let me know.
>
> If something isn't working, sometimes there's newer version available on the `develop` branch. To try it, click [this link](https://raw.githubusercontent.com/tajnymag/tinder-deblur/develop/tinder.user.js).
> Once there's a newer stable version, your userscript extension should update you automatically to it.

## How to use

1. install a userscript manager ([Violentmonkey](https://violentmonkey.github.io/), [Tampermonkey](https://www.tampermonkey.net/), [Greasemonkey](https://www.greasespot.net/), ...)
2. install the script:
    * either click [this link](https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js) and the manager will install the script for you
    * or copy the URL below and install it manually through manager's UI

    `https://raw.githubusercontent.com/tajnymag/tinder-deblur/main/tinder.user.js`
3. browse the Tinder web app normally and the profiles that like you should be unblurred

## How it works/**worked**

Initially, Tinder API returned clean profile images on requests that had their headers stripped down.
Tinder patched this exploit for the web app. However, they did not patch it for their Android API.
Recently, Tinder made the user endpoint only accessible to matches, that's why the username, age etc. cannot be seen any more, though the unblur, like and pass functions remain.

**Be prepared** for this exploit to be patched sooner or later.

## Contributors

<a href="https://github.com/tajnymag/tinder-deblur/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tajnymag/tinder-deblur" />
</a>
