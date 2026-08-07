import { createPRNG } from "../../core/random";

const TINCTURES = ["#fbbf24", "#f8fafc", "#ef4444", "#3b82f6", "#1e293b", "#16a34a"]; // Or, Argent, Gules, Azure, Sable, Vert
const CHARGES = [
  // Cross path
  `<path d="M 40,20 H 60 V 45 H 85 V 65 H 60 V 90 H 40 V 65 H 15 V 45 H 40 Z" fill="{color}" stroke="#ffffff" stroke-width="2"/>`,
  // Star path
  `<polygon points="50,15 60,40 85,40 65,55 75,80 50,65 25,80 35,55 15,40 40,40" fill="{color}" stroke="#ffffff" stroke-width="2"/>`,
  // Sword path
  `<path d="M 48,15 H 52 V 65 H 58 V 70 H 52 V 80 H 48 V 70 H 42 V 65 H 48 Z" fill="{color}" stroke="#ffffff" stroke-width="2"/>`,
  // Shield/Inner badge path
  `<path d="M 30,25 H 70 V 55 C 70,75 50,85 50,85 C 50,85 30,75 30,55 Z" fill="{color}" stroke="#ffffff" stroke-width="2"/>`
];

export function generateEmblem(seed: string): string {
  const rng = createPRNG(seed);

  const fieldColor = TINCTURES[Math.floor(rng() * TINCTURES.length)];
  const divisionColor = TINCTURES[Math.floor(rng() * TINCTURES.length)];
  const chargeColor = TINCTURES[Math.floor(rng() * TINCTURES.length)];

  const divisions = [
    // Solid field
    `<rect width="100" height="100" fill="${fieldColor}"/>`,
    // Per pale (vertical split)
    `<rect width="50" height="100" fill="${fieldColor}"/>
     <rect x="50" width="50" height="100" fill="${divisionColor}"/>`,
    // Per fess (horizontal split)
    `<rect width="100" height="50" fill="${fieldColor}"/>
     <rect y="50" width="100" height="50" fill="${divisionColor}"/>`,
    // Quarterly
    `<rect width="50" height="50" fill="${fieldColor}"/>
     <rect x="50" width="50" height="50" fill="${divisionColor}"/>
     <rect y="50" width="50" height="50" fill="${divisionColor}"/>
     <rect x="50" y="50" width="50" height="50" fill="${fieldColor}"/>`
  ];

  const fieldSVG = divisions[Math.floor(rng() * divisions.length)];
  const chargeTemplate = CHARGES[Math.floor(rng() * CHARGES.length)];
  const chargeSVG = chargeTemplate.replace("{color}", chargeColor);

  // Return complete SVG with a shield mask clip path
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48">
    <defs>
      <clipPath id="shield-clip">
        <path d="M 10,10 H 90 V 50 C 90,75 50,95 50,95 C 50,95 10,75 10,50 Z" />
      </clipPath>
    </defs>
    <g clip-path="url(#shield-clip)">
      ${fieldSVG}
      ${chargeSVG}
      <path d="M 10,10 H 90 V 50 C 90,75 50,95 50,95 C 50,95 10,75 10,50 Z" fill="none" stroke="#ffffff" stroke-width="4"/>
    </g>
  </svg>`;
}
