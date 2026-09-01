{
  lib,
  buildNpmPackage,
  copyDesktopItems,
  electron_43,
  fetchNpmDeps,
  jq,
  makeDesktopItem,
  makeWrapper,
  runCommand,
}:

buildNpmPackage (finalAttrs: {
  pname = "fantasy-map-generator";
  version = (lib.importJSON ../package.json).version;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../build
      ../electron
      ../package.json
      ../package-lock.json
      ../public
      ../scripts
      ../src
      ../tsconfig.json
      ../vite.config.ts
    ];
  };

  # Hashing the lock file as-is would tie this hash to the app version, because
  # `sync-version.js` rewrites the root version in package-lock.json on every bump —
  # a pre-commit hook, so it happens constantly. Nothing but the dependency set should
  # move this hash, so the version is flattened out before it is taken.
  npmDeps = fetchNpmDeps {
    name = "${finalAttrs.pname}-npm-deps";
    src = runCommand "${finalAttrs.pname}-package-lock" { nativeBuildInputs = [ jq ]; } ''
      mkdir -p $out
      jq '(.version, .packages."".version) |= "0.0.0"' \
        ${../package-lock.json} > $out/package-lock.json
    '';
    hash = "sha256-utazUT7y4IDtd+HxNP7zOze2ipq1qtqbEqFiDn3rpQE=";
  };

  # the lock file is hashed with its version flattened, so the copy npm checks must match
  postPatch = ''
    ${lib.getExe jq} '(.version, .packages."".version) |= "0.0.0"' package-lock.json > lock.tmp
    mv lock.tmp package-lock.json
  '';

  # `prepare` installs git hooks, and electron's postinstall downloads a browser we do not use
  npmFlags = [ "--ignore-scripts" ];
  dontNpmBuild = true;

  nativeBuildInputs = [
    copyDesktopItems
    makeWrapper
  ];

  # `npm run electron build` typechecks and bundles both processes into dist-electron/,
  # stopping short of electron-builder, which would fetch prebuilt binaries over the network
  buildPhase = ''
    runHook preBuild
    npm run electron build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/fantasy-map-generator
    cp -r dist-electron $out/share/fantasy-map-generator/
    cp package.json $out/share/fantasy-map-generator/

    install -Dm644 build/icon.png \
      $out/share/icons/hicolor/512x512/apps/fantasy-map-generator.png

    makeWrapper ${lib.getExe electron_43} $out/bin/fantasy-map-generator \
      --add-flags $out/share/fantasy-map-generator \
      --add-flags "\''${NIXOS_OZONE_WL:+\''${WAYLAND_DISPLAY:+--ozone-platform-hint=auto --enable-features=WaylandWindowDecorations}}" \
      --inherit-argv0

    runHook postInstall
  '';

  desktopItems = [
    (makeDesktopItem {
      name = "fantasy-map-generator";
      exec = "fantasy-map-generator %U";
      icon = "fantasy-map-generator";
      desktopName = "Fantasy Map Generator";
      genericName = "Fantasy Map Editor";
      comment = "Generate and edit fantasy maps";
      categories = [
        "Graphics"
        "Education"
      ];
      keywords = [
        "map"
        "fantasy"
        "cartography"
        "worldbuilding"
      ];
    })
  ];

  meta = {
    description = "Free web application that helps fantasy writers, game masters and cartographers create and edit fantasy maps";
    homepage = "https://github.com/Azgaar/Fantasy-Map-Generator";
    license = lib.licenses.mit;
    mainProgram = "fantasy-map-generator";
    # the wrapper starts a bare Electron; macOS wants a real .app bundle, so use the dmg release there
    platforms = lib.platforms.linux;
  };
})
