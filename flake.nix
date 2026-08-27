{
  description = "Azgaar's Fantasy Map Generator";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      # x86_64-darwin is absent because nixpkgs 26.11 dropped it: naming a system it no
      # longer supports makes every output for it throw rather than simply not exist
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # the package wraps a bare Electron, which is not a macOS .app bundle, so it is
      # offered only where it can run; `nix develop` still works everywhere
      linuxSystems = nixpkgs.lib.filter (nixpkgs.lib.hasSuffix "-linux") systems;
      forLinuxSystems = f: nixpkgs.lib.genAttrs linuxSystems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forLinuxSystems (pkgs: {
        fantasy-map-generator = pkgs.callPackage ./nix/package.nix { };
        default = self.packages.${pkgs.stdenv.hostPlatform.system}.fantasy-map-generator;
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs ];
        };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);
    };
}
