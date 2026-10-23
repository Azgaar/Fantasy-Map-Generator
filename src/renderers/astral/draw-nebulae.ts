// Nebulae: seeded gas clouds over the sector; the layer is decorative, so no pointer events
import type { Layer } from "@/components/layers";
import { resolvePerformancePreset } from "@/components/performance";
import { getNebulae, NEBULA_GROUPS, type NebulaCluster, type NebulaEllipse, type NebulaGroup } from "./nebula-shapes";

export function drawNebulae(layer: Layer): void {
  TIME && console.time("drawNebulae");

  const { count, size, softness } = styles.nebulae.options;
  const { width, height } = options.map.graph;
  const filters = resolvePerformancePreset(options.app.performance) !== "speed";
  const seed = `${options.map.seed}|astral|nebulae`;
  const clusters = getNebulae({ width, height, count, size, seed, filters });

  const element = layer.getEl();
  element.querySelector("defs")?.remove();
  element.insertAdjacentHTML("beforeend", writeDefs(clusters, softness, filters));

  for (const group of NEBULA_GROUPS) {
    const target = element.querySelector(`[data-group="${group}"]`);
    if (!target) continue;
    target.innerHTML = clusters
      .filter(cluster => cluster.group === group)
      .map(cluster => writeCluster(cluster, filters))
      .join("");
  }

  TIME && console.timeEnd("drawNebulae");
}

/** One turbulence filter per cluster, or one fade gradient per gas palette when filters are off */
function writeDefs(clusters: NebulaCluster[], softness: number, filters: boolean): string {
  const content = filters
    ? clusters.map((_, index) => turbulence(index, softness)).join("")
    : NEBULA_GROUPS.map(group => fade(group)).join("");
  return /* html */ `<defs id="nebulae-defs">${content}</defs>`;
}

function turbulence(index: number, softness: number): string {
  return /* html */ `<filter id="nebulae-filter-${index}" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="${index + 1}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="${round(softness * 3)}"/>
      <feGaussianBlur stdDeviation="${round(softness * 0.4)}"/>
    </filter>`;
}

function fade(group: NebulaGroup): string {
  const { fill } = styles.nebulae.groups[group].attrs;
  const color = fill ?? "#ffffff";
  return /* html */ `<radialGradient id="nebulae-fade-${group}">
      <stop offset="0" stop-color="${color}"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>`;
}

function writeCluster(cluster: NebulaCluster, filters: boolean): string {
  const filter = cluster.filter ? ` filter="${cluster.filter}"` : "";
  return /* html */ `<g${filter}>${cluster.ellipses.map(ellipse => writeEllipse(ellipse, cluster.group, filters)).join("")}</g>`;
}

function writeEllipse(
  { cx, cy, rx, ry, rotate, opacity }: NebulaEllipse,
  group: NebulaGroup,
  filters: boolean
): string {
  // the speed preset fades each cloud to nothing; the quality presets lean on the blur filters
  const fill = filters ? "" : ` fill="url(#nebulae-fade-${group})"`;
  return /* html */ `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" opacity="${opacity}"${fill} transform="rotate(${rotate} ${cx} ${cy})"/>`;
}

const round = (value: number) => Math.round(value * 100) / 100;
