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
