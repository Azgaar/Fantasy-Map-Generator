# Fantasy Map Generator

Azgaar's _Fantasy Map Generator_ is a free web application that helps fantasy writers, game masters, and cartographers create and edit fantasy maps.

Link: [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator).

Refer to the [project wiki](https://github.com/Azgaar/Fantasy-Map-Generator/wiki) for guidance. Development is tracked on the [FMG dev board](https://github.com/users/Azgaar/projects/3). Some details are covered in my old blog [_Fantasy Maps for fun and glory_](https://azgaar.wordpress.com).

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/9502eae9-92e0-4d0d-9f17-a2ba4a565c01)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/11a42446-4bd5-4526-9cb1-3ef97c868992)

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/e751a9e5-7986-4638-b8a9-362395ef7583)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/e751a9e5-7986-4638-b8a9-362395ef7583)

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/b0d0efde-a0d1-4e80-8818-ea3dd83c2323)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/b0d0efde-a0d1-4e80-8818-ea3dd83c2323)

Join our [Discord server](https://discordapp.com/invite/X7E84HU) and [Reddit community](https://www.reddit.com/r/FantasyMapGenerator) to share your creations, discuss the Generator, suggest ideas and get the most recent updates.

Report bugs with the [bug report form](https://github.com/Azgaar/Fantasy-Map-Generator/issues/new?template=bug_report.yml), suggest features in [Ideas discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/ideas), and ask usage questions in [Q&A](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/q-a). Search existing reports first. For bugs, include your FMG version, browser/OS, reproduction steps and an affected `.map` file in a ZIP archive when relevant. For ideas, explain the problem and your use case.

In Discord, use `#fmg-bugs` or `#fmg-suggestions`; the assistant's `/bug` and `/idea` commands, when available, open forms for moderator review before GitHub submission. Asking the assistant a question does not file a report. See [reporting instructions and examples](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Reporting-bugs-and-ideas).

Contact me via [email](mailto:azgaar.fmg@yandex.com) for non-public suggestions. For performance problems, first check the [performance tips](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A#the-map-performance-is-poor-how-can-i-improve-it).

You can support the project on [Patreon](https://www.patreon.com/azgaar).

_Inspiration:_

- Martin O'Leary's [_Generating fantasy maps_](https://mewo2.com/notes/terrain)

- Amit Patel's [_Polygonal Map Generation for Games_](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation)

- Scott Turner's [_Here Dragons Abound_](https://heredragonsabound.blogspot.com)

## Desktop app

Installers for Linux, Windows and macOS are attached to each
[release](https://github.com/Azgaar/Fantasy-Map-Generator/releases). Nix users can build
the same app from the flake instead — see [Install with Nix](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Install-with-Nix):

```sh
nix run github:Azgaar/Fantasy-Map-Generator
```

## Contribution

Pull requests are highly welcomed. The codebase is messy and I will appreciate if you start with minor changes. Check out the [data model](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-model) before contributing.

The codebase is gradually transitioning from **vanilla JavaScript to TypeScript** while maintaining compatibility with the existing generation pipeline and old `.map` user files.

The expected **future** architecture is based on a separation between **world data**, **procedural generation**, **interactive editing**, and **rendering**. The application is conceptually divided into four main layers: world data and styles (state), generators (model), editors (controllers), renderers (view).

Flow:
settings → generators → world data → renderer
UI → editors → world data → renderer.

The data layer must contain no logic and no rendering code. Generators implement the procedural world simulation. Editors implement interactive editing tools used by the user. They perform controlled mutations of the world state. Editors can be viewed as interactive generators. The renderer converts the world state into SVG or WebGl graphics. Renderer must be pure visualization step and not modify world data.


## 🌐 Web Resources & Aesthetic Symbols Index
- [BLUSHING SOFT SMILE KAOMOJI](https://vintage-angel-text-38.pages.dev/symbol/blushing-soft-smile-kaomoji/)
- [SYM 26C5](https://minimal-star-symbols-74.pages.dev/symbol/sym-26c5/)
- [DISCORD STATUS](https://anime-sparkle-text-81.pages.dev/ja/discord-status/)
- [CIRCLED STAR](https://occult-aesthetic-symbols-26.pages.dev/symbol/circled-star/)
- [SYM 1D45F](https://classic-literature-symbols-64.pages.dev/symbol/sym-1d45f/)
- [SYM 1D431](https://scholarly-script-hub-43.pages.dev/symbol/sym-1d431/)
- [LEO ZODIAC LION](https://minimal-star-symbols-32.pages.dev/symbol/leo-zodiac-lion/)
- [SYM 2746](https://kawaii-kaomoji-hub-31.pages.dev/symbol/sym-2746/)
- [SYM 1D48F](https://minimal-star-symbols-32.pages.dev/symbol/sym-1d48f/)
- [EIGHT POINTED BLACK STAR](https://kawaii-kaomoji-hub-31.pages.dev/symbol/eight-pointed-black-star/)
- [GEMINI ZODIAC TWINS](https://minimal-star-symbols-32.pages.dev/symbol/gemini-zodiac-twins/)
- [SYM 1D498](https://pastel-moe-kaomoji-91.pages.dev/symbol/sym-1d498/)
- [SYM 1D47A](https://baroque-unicode-decor-43.pages.dev/symbol/sym-1d47a/)
- [SYM 26DA](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-26da/)
- [SYM 1D465](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-1d465/)
- [SYM 1F600](https://kawaii-kaomoji-hub-31.pages.dev/symbol/sym-1f600/)
- [CYBER PHANTOM GLYPH](https://academic-rune-text-25.pages.dev/symbol/cyber-phantom-glyph/)
- [BLACK STAR](https://clean-mono-fonts-64.pages.dev/symbol/black-star/)
- [SYM 260B](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-260b/)
- [SYM 1D484](https://dark-poetry-fonts-30.pages.dev/symbol/sym-1d484/)
- [SYM 26C1](https://cyber-clan-tags-20.pages.dev/symbol/sym-26c1/)
- [SYM 1D452](https://academic-rune-text-25.pages.dev/symbol/sym-1d452/)
- [SYM 1F636](https://academic-rune-text-25.pages.dev/symbol/sym-1f636/)
- [SYM 1F47D](https://neon-hacker-text-25.pages.dev/symbol/sym-1f47d/)
- [UPWARD DIAGONAL ARROW](https://academic-rune-text-25.pages.dev/symbol/upward-diagonal-arrow/)
- [SYM 1D477](https://pink-ribbon-fonts-28.pages.dev/symbol/sym-1d477/)
- [RINGED PLANET SATURN](https://glitch-matrix-fonts-28.pages.dev/symbol/ringed-planet-saturn/)
- [SYM 2687](https://pastel-moe-kaomoji-91.pages.dev/symbol/sym-2687/)
- [PINK RIBBON FONTS 28.PAGES.DEV](https://pink-ribbon-fonts-28.pages.dev/)
- [TIBETAN LOTUS BLOSSOM](https://academic-rune-text-25.pages.dev/symbol/tibetan-lotus-blossom/)
- [ZODIAC CELESTIAL](https://glitch-matrix-fonts-28.pages.dev/ru/zodiac-celestial/)
- [SYM 1F496](https://baroque-text-decor-84.pages.dev/symbol/sym-1f496/)
- [SYM 26DF](https://baroque-text-decor-84.pages.dev/symbol/sym-26df/)
- [SYM 26CE](https://baroque-text-decor-84.pages.dev/symbol/sym-26ce/)
- [SYM 263A FE0F](https://kawaii-kaomoji-hub-31.pages.dev/symbol/sym-263a-fe0f/)
- [SYM 2748](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-2748/)
- [DAGGER CROSS SYMBOL](https://pink-ribbon-fonts-28.pages.dev/symbol/dagger-cross-symbol/)
- [SYM 1D4A3](https://angelic-bio-symbols-90.pages.dev/symbol/sym-1d4a3/)
- [SYM 1FAE3](https://sleek-mono-symbols-75.pages.dev/symbol/sym-1fae3/)
- [RIGHT HEAVY BRACKET BOX](https://zen-unicode-text-36.pages.dev/symbol/right-heavy-bracket-box/)
- [SYM 2743](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-2743/)
- [SYM 268C](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-268c/)
- [SYM 1F604](https://academic-rune-text-25.pages.dev/symbol/sym-1f604/)
- [SYM 1D49F](https://pastel-chibi-fonts-48.pages.dev/symbol/sym-1d49f/)
- [SYM 1F495](https://minimal-star-symbols-28.pages.dev/symbol/sym-1f495/)
- [SIXTEEN POINTED STAR](https://pink-ribbon-fonts-28.pages.dev/symbol/sixteen-pointed-star/)
- [LEFT POINTING DOUBLE ANGLE QUOTATION](https://sleek-typography-hub-12.pages.dev/symbol/left-pointing-double-angle-quotation/)
- [SYM 2687](https://mystic-occult-fonts-26.pages.dev/symbol/sym-2687/)
- [SYM 1F607](https://dark-poetry-fonts-30.pages.dev/symbol/sym-1f607/)
- [HEARTS](https://angelic-soft-text-59.pages.dev/ru/hearts/)
- [NATURE FLOWERS](https://pastel-kaomoji-vault-54.pages.dev/ru/nature-flowers/)
- [SYM 2658](https://pastel-moe-kaomoji-91.pages.dev/symbol/sym-2658/)
- [CIRCLED STAR](https://pink-ribbon-fonts-28.pages.dev/symbol/circled-star/)
- [SYM 1F47F](https://pastel-chibi-fonts-48.pages.dev/symbol/sym-1f47f/)
- [SYM 26A9](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-26a9/)
- [TIKTOK CAPTIONS](https://zen-space-symbols-89.pages.dev/pt/tiktok-captions/)
- [SYM 267F](https://vintage-scholar-text-78.pages.dev/symbol/sym-267f/)
- [HEARTS](https://pastel-moe-kaomoji-91.pages.dev/hearts/)
- [DAGGER BLADE](https://neon-hacker-text-25.pages.dev/symbol/dagger-blade/)
- [SYM 1F92B](https://anime-sparkle-text-51.pages.dev/symbol/sym-1f92b/)
- [SYM 26EA](https://vampiric-text-craft-82.pages.dev/symbol/sym-26ea/)
- [AQUARIUS ZODIAC WATER BEARER](https://neon-hacker-text-25.pages.dev/symbol/aquarius-zodiac-water-bearer/)
- [SYM 1D419](https://chibi-emotion-faces-74.pages.dev/symbol/sym-1d419/)
- [SYM 2610](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-2610/)
- [GAMING WEAPONS](https://pink-ribbon-fonts-28.pages.dev/ru/gaming-weapons/)
- [BRACKETS](https://matrix-terminal-fonts-30.pages.dev/es/brackets/)
- [BEAMED EIGHTH NOTES](https://angelic-soft-text-59.pages.dev/symbol/beamed-eighth-notes/)
- [SYM 1F979](https://synthwave-bio-maker-62.pages.dev/symbol/sym-1f979/)
- [SYM 2636](https://soft-pastel-unicode-78.pages.dev/symbol/sym-2636/)
- [MUSIC WEATHER](https://chibi-flower-emoticons-63.pages.dev/es/music-weather/)
- [SPARKLE DOT FLARE](https://subtle-arrow-fonts-98.pages.dev/symbol/sparkle-dot-flare/)
- [SYM 1D401](https://geometric-bio-symbols-76.pages.dev/symbol/sym-1d401/)
- [SYM 26C7](https://vampiric-text-craft-82.pages.dev/symbol/sym-26c7/)
- [LEFT WING CLAN FLARE](https://academic-rune-text-25.pages.dev/symbol/left-wing-clan-flare/)
- [SYM 1D47D](https://coquette-aesthetic-symbols-96.pages.dev/symbol/sym-1d47d/)
- [SYM 1D4A5](https://gothic-bio-fonts-98.pages.dev/symbol/sym-1d4a5/)
- [SYM 274B](https://minimal-star-symbols-32.pages.dev/symbol/sym-274b/)
- [LATIN CROSS FAITH](https://matrix-terminal-fonts-30.pages.dev/symbol/latin-cross-faith/)
- [ZODIAC CELESTIAL](https://academic-rune-text-25.pages.dev/zodiac-celestial/)
- [SYM 1F914](https://matrix-terminal-fonts-30.pages.dev/symbol/sym-1f914/)
- [SYM 2678](https://sleek-bio-symbols-40.pages.dev/symbol/sym-2678/)
- [SYM 2676](https://cyber-clan-tags-85.pages.dev/symbol/sym-2676/)
- [ZODIAC CELESTIAL](https://pastel-chibi-fonts-48.pages.dev/vi/zodiac-celestial/)
- [TWELVE POINTED STAR](https://geometric-bio-symbols-76.pages.dev/symbol/twelve-pointed-star/)
- [SYM 26E1](https://anime-sparkle-text-58.pages.dev/symbol/sym-26e1/)
- [SYM 26E8](https://soft-angel-symbols-61.pages.dev/symbol/sym-26e8/)
- [LEFT POINTING DOUBLE ANGLE QUOTATION](https://cyber-clan-tags-65.pages.dev/symbol/left-pointing-double-angle-quotation/)
- [SYM 2617](https://moe-star-kaomoji-60.pages.dev/symbol/sym-2617/)
- [SYM 1F622](https://soft-bow-fonts-22.pages.dev/symbol/sym-1f622/)
- [SYM 1FAE2](https://chibi-emotion-faces-74.pages.dev/symbol/sym-1fae2/)
- [FREEFIRE NAMES](https://balletcore-bio-symbols-63.pages.dev/freefire-names/)
- [SYM 1F47A](https://cyber-clan-tags-90.pages.dev/symbol/sym-1f47a/)
- [SYM 26C8](https://lace-and-ribbon-text-61.pages.dev/symbol/sym-26c8/)
- [SYM 1D43F](https://clean-aesthetic-fonts-33.pages.dev/symbol/sym-1d43f/)
- [SYM 26B7](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-26b7/)
- [SYM 274A](https://vampiric-text-craft-82.pages.dev/symbol/sym-274a/)
- [SYM 1F47B](https://classic-literature-symbols-64.pages.dev/symbol/sym-1f47b/)
- [SYM 1F636 200D 1F32B FE0F](https://chibi-heart-symbols-15.pages.dev/symbol/sym-1f636-200d-1f32b-fe0f/)
- [SYM 1D435](https://pastel-kaomoji-vault-54.pages.dev/symbol/sym-1d435/)
- [SYM 1D473](https://pastel-kaomoji-vault-54.pages.dev/symbol/sym-1d473/)
- [SYM 2610](https://balletcore-unicode-67.pages.dev/symbol/sym-2610/)
- [SYM 1F60D](https://academic-rune-text-25.pages.dev/symbol/sym-1f60d/)
- [SYM 26F5](https://gothic-bio-fonts-98.pages.dev/symbol/sym-26f5/)
- [SYM 1D400](https://vintage-lace-text-53.pages.dev/symbol/sym-1d400/)
- [HEARTS](https://gothic-bio-fonts-32.pages.dev/vi/hearts/)
- [SYM 267C](https://minimal-star-symbols-87.pages.dev/symbol/sym-267c/)
- [SYM 1F47E](https://vintage-lace-text-53.pages.dev/symbol/sym-1f47e/)
- [SYM 26DE](https://gothic-bio-fonts-24.pages.dev/symbol/sym-26de/)
- [PINWHEEL STAR](https://scholarly-unicode-vault-92.pages.dev/symbol/pinwheel-star/)
- [SYM 1F48C](https://anime-sparkle-text-92.pages.dev/symbol/sym-1f48c/)
- [BLACK FOUR POINT STAR](https://glitch-matrix-fonts-28.pages.dev/symbol/black-four-point-star/)
- [SYM 2688](https://soft-bow-fonts-22.pages.dev/symbol/sym-2688/)
- [SYM 267A](https://minimal-star-symbols-32.pages.dev/symbol/sym-267a/)
- [SYM 26A6](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-26a6/)
- [SYM 2683](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-2683/)
- [SYM 26F0](https://vintage-lace-text-53.pages.dev/symbol/sym-26f0/)
- [DOWNWARD DIAGONAL ARROW](https://raven-gothic-text-44.pages.dev/symbol/downward-diagonal-arrow/)
- [SYM 1F976](https://geometric-bio-symbols-76.pages.dev/symbol/sym-1f976/)
- [KHANDA EMBLEM](https://anime-sparkle-text-76.pages.dev/symbol/khanda-emblem/)
- [SYM 1F49E](https://anime-sparkle-text-56.pages.dev/symbol/sym-1f49e/)
- [ROBLOX NAMES](https://vintage-lace-text-53.pages.dev/ja/roblox-names/)
- [SYM 1D433](https://neon-futuristic-symbols-58.pages.dev/symbol/sym-1d433/)
- [SYM 1D439](https://coquette-aesthetic-symbols-88.pages.dev/symbol/sym-1d439/)
- [SYM 1F912](https://classic-literature-runes-13.pages.dev/symbol/sym-1f912/)
- [SYM 2747](https://lace-and-ribbon-text-61.pages.dev/symbol/sym-2747/)
- [MUSIC SHARP SIGN](https://minimal-star-symbols-87.pages.dev/symbol/music-sharp-sign/)
- [SYM 1D47D](https://theeduplaycampen.pages.dev/symbol/sym-1d47d/)
- [SYM 1D487](https://clean-aesthetic-fonts-33.pages.dev/symbol/sym-1d487/)
- [SYM 1D44B](https://balletcore-bio-symbols-63.pages.dev/symbol/sym-1d44b/)
- [SYM 273D](https://coquette-aesthetic-symbols-51.pages.dev/symbol/sym-273d/)
