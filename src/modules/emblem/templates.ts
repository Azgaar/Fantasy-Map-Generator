export const templates: Record<string, string | ((line: string) => string)> = {
  // straight divisions
  perFess: `<rect x="0" y="100" width="200" height="100"/>`,
  perPale: `<rect x="100" y="0" width="100" height="200"/>`,
  perBend: `<polygon points="0,0 200,200 0,200"/>`,
  perBendSinister: `<polygon points="200,0 0,200 200,200"/>`,
  perChevron: `<polygon points="0,200 100,100 200,200"/>`,
  perChevronReversed: `<polygon points="0,0 100,100 200,0"/>`,
  perCross: `<rect x="100" y="0" width="100" height="100"/><rect x="0" y="100" width="100" height="100"/>`,
  perPile: `<polygon points="0,0 15,0 100,200 185,0 200,0 200,200 0,200"/>`,
  perSaltire: `<polygon points="0,0 0,200 200,0 200,200"/>`,
  gyronny: `<polygon points="0,0 200,200 200,100 0,100"/><polygon points="200,0 0,200 100,200 100,0"/>`,
  chevronny: `<path d="M0,80 100,-15 200,80 200,120 100,25 0,120z M0,160 100,65 200,160 200,200 100,105 0,200z M0,240 100,145 200,240 0,240z"/>`,
  // lined divisions
  perFessLined: (line: string) =>
    `<path d="${line}"/><rect x="0" y="115" width="200" height="85" shape-rendering="crispedges"/>`,
  perPaleLined: (line: string) =>
    `<path d="${line}" transform="rotate(-90 100 100)"/><rect x="115" y="0" width="85" height="200" shape-rendering="crispedges"/>`,
  perBendLined: (line: string) =>
    `<path d="${line}" transform="translate(-10 -10) rotate(45 110 110) scale(1.1)"/><rect x="0" y="115" width="200" height="85" transform="translate(-10 -10) rotate(45 110 110) scale(1.1)" shape-rendering="crispedges"/>`,
  perBendSinisterLined: (line: string) =>
    `<path d="${line}" transform="translate(-10 -10) rotate(-45 110 110) scale(1.1)"/><rect x="0" y="115" width="200" height="85" transform="translate(-10 -10) rotate(-45 110 110) scale(1.1)" shape-rendering="crispedges"/>`,
  perChevronLined: (line: string) =>
    `<rect x="15" y="115" width="200" height="200" transform="translate(70 70) rotate(45 100 100)"/><path d="${line}" transform="translate(129 71) rotate(-45 -100 100) scale(-1 1)"/><path d="${line}" transform="translate(71 71) rotate(45 100 100)"/>`,
  perChevronReversedLined: (line: string) =>
    `<rect x="15" y="115" width="200" height="200" transform="translate(-70 -70) rotate(225.001 100 100)"/><path d="${line}" transform="translate(-70.7 -70.7) rotate(225 100 100) scale(1 1)"/><path d="${line}" transform="translate(270.7 -70.7) rotate(-225 -100 100) scale(-1 1)"/>`,
  perCrossLined: (line: string) =>
    `<rect x="100" y="0" width="100" height="92.5"/><rect x="0" y="107.5" width="100" height="92.5"/><path d="${line}" transform="translate(0 50) scale(.5001)"/><path d="${line}" transform="translate(200 150) scale(-.5)"/>`,
  perPileLined: (line: string) =>
    `<path d="${line}" transform="translate(161.66 10) rotate(66.66 -100 100) scale(-1 1)"/><path d="${line}" transform="translate(38.33 10) rotate(-66.66 100 100)"/><polygon points="-2.15,0 84.15,200 115.85,200 202.15,0 200,200 0,200"/>`,
  // straight ordinaries
  fess: `<rect x="0" y="75" width="200" height="50"/>`,
  pale: `<rect x="75" y="0" width="50" height="200"/>`,
  bend: `<polygon points="35,0 200,165 200,200 165,200 0,35 0,0"/>`,
  bendSinister: `<polygon points="0,165 165,0 200,0 200,35 35,200 0,200"/>`,
  chief: `<rect width="200" height="75"/>`,
  bar: `<rect x="0" y="87.5" width="200" height="25"/>`,
  gemelle: `<rect x="0" y="76" width="200" height="16"/><rect x="0" y="108" width="200" height="16"/>`,
  fessCotissed: `<rect x="0" y="67" width="200" height="8"/><rect x="0" y="83" width="200" height="34"/><rect x="0" y="125" width="200" height="8"/>`,
  fessDoubleCotissed: `<rect x="0" y="60" width="200" height="7.5"/><rect x="0" y="72.5" width="200" height="7.5"/><rect x="0" y="85" width="200" height="30"/><rect x="0" y="120" width="200" height="7.5"/><rect x="0" y="132.5" width="200" height="7.5"/>`,
  bendlet: `<polygon points="22,0 200,178 200,200 178,200 0,22 0,0"/>`,
  bendletSinister: `<polygon points="0,178 178,0 200,0 200,22 22,200 0,200"/>`,
  terrace: `<rect x="0" y="145" width="200" height="55"/>`,
  cross: `<polygon points="85,0 85,85 0,85 0,115 85,115 85,200 115,200 115,115 200,115 200,85 115,85 115,0"/>`,
  crossParted: `<path d="M 80 0 L 80 80 L 0 80 L 0 95 L 80 95 L 80 105 L 0 105 L 0 120 L 80 120 L 80 200 L 95 200 L 95 120 L 105 120 L 105 200 L 120 200 L 120 120 L 200 120 L 200 105 L 120 105 L 120 95 L 200 95 L 200 80 L 120 80 L 120 0 L 105 0 L 105 80 L 95 80 L 95 0 L 80 0 z M 95 95 L 105 95 L 105 105 L 95 105 L 95 95 z"/>`,
  saltire: `<path d="M 0,21 79,100 0,179 0,200 21,200 100,121 179,200 200,200 200,179 121,100 200,21 200,0 179,0 100,79 21,0 0,0 Z"/>`,
  saltireParted: `<path d="M 7 0 L 89 82 L 82 89 L 0 7 L 0 28 L 72 100 L 0 172 L 0 193 L 82 111 L 89 118 L 7 200 L 28 200 L 100 128 L 172 200 L 193 200 L 111 118 L 118 111 L 200 193 L 200 172 L 128 100 L 200 28 L 200 7 L 118 89 L 111 82 L 193 0 L 172 0 L 100 72 L 28 0 L 7 0 z M 100 93 L 107 100 L 100 107 L 93 100 L 100 93 z"/>`,
  mount: `<path d="m0,250 a100,100,0,0,1,200,0"/>`,
  point: `<path d="M0,200 Q80,180 100,135 Q120,180 200,200"/>`,
  flaunches: `<path d="M0,0 q120,100 0,200 M200,0 q-120,100 0,200"/>`,
  gore: `<path d="M20,0 Q30,75 100,100 Q80,150 100,200 L0,200 L0,0 Z"/>`,
  pall: `<polygon points="0,0 30,0 100,70 170,0 200,0 200,30 122,109 122,200 78,200 78,109 0,30"/>`,
  pallReversed: `<polygon points="0,200 0,170 78,91 78,0 122,0 122,91 200,170 200,200 170,200 100,130 30,200"/>`,
  chevron: `<polygon points="0,125 100,60 200,125 200,165 100,100 0,165"/>`,
  chevronReversed: `<polygon points="0,75 100,140 200,75 200,35 100,100 0,35"/>`,
  gyron: `<polygon points="0,0 100,100 0,100"/>`,
  quarter: `<rect width="50%" height="50%"/>`,
  canton: `<rect width="37.5%" height="37.5%"/>`,
  pile: `<polygon points="70,0 100,175 130,0"/>`,
  pileInBend: `<polygon points="200,200 200,144 25,25 145,200"/>`,
  pileInBendSinister: `<polygon points="0,200 0,144 175,25 55,200"/>`,
  piles: `<polygon points="46,0 75,175 103,0"/><polygon points="95,0 125,175 154,0"/>`,
  pilesInPoint: `<path d="M15,0 100,200 60,0Z M80,0 100,200 120,0Z M140,0 100,200 185,0Z"/>`,
  label: `<path d="m 46,54.8 6.6,-15.6 95.1,0 5.9,15.5 -16.8,0.1 4.5,-11.8 L 104,43 l 4.3,11.9 -16.8,0 4.3,-11.8 -37.2,0 4.5,11.8 -16.9,0 z"/>`,
  // lined ordinaries
  fessLined: (line: string) =>
    `<path d="${line}" transform="translate(0 -25)"/><path d="${line}" transform="translate(0 25) rotate(180 100 100)"/><rect x="0" y="88" width="200" height="24" stroke="none"/>`,
  paleLined: (line: string) =>
    `<path d="${line}" transform="rotate(-90 100 100) translate(0 -25)"/><path d="${line}" transform="rotate(90 100 100) translate(0 -25)"/><rect x="88" y="0" width="24" height="200" stroke="none"/>`,
  bendLined: (line: string) =>
    `<path d="${line}" transform="translate(8 -18) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-28 18) rotate(225 110 100) scale(1.1 1)"/><rect x="0" y="88" width="200" height="24" transform="translate(-10 0) rotate(45 110 100) scale(1.1 1)" stroke="none"/>`,
  bendSinisterLined: (line: string) =>
    `<path d="${line}" transform="translate(-28 -18) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(8 18) rotate(-225 110 100) scale(1.1 1)"/><rect x="0" y="88" width="200" height="24" transform="translate(-10 0) rotate(-45 110 100) scale(1.1 1)" stroke="none"/>`,
  chiefLined: (line: string) =>
    `<path d="${line}" transform="translate(0,-25) rotate(180.00001 100 100)"/><rect width="200" height="62" stroke="none"/>`,
  barLined: (line: string) =>
    `<path d="${line}" transform="translate(0,-12.5)"/><path d="${line}" transform="translate(0,12.5) rotate(180.00001 100 100)"/><rect x="0" y="94" width="200" height="12" stroke="none"/>`,
  gemelleLined: (line: string) =>
    `<path d="${line}" transform="translate(0,-22.5)"/><path d="${line}" transform="translate(0,22.5) rotate(180.00001 100 100)"/>`,
  fessCotissedLined: (line: string) =>
    `<path d="${line}" transform="translate(0 15) scale(1 .5)"/><path d="${line}" transform="translate(0 85) rotate(180 100 50) scale(1 .5)"/><rect x="0" y="80" width="200" height="40"/>`,
  fessDoubleCotissedLined: (line: string) =>
    `<rect x="0" y="85" width="200" height="30"/><rect x="0" y="72.5" width="200" height="7.5"/><rect x="0" y="120" width="200" height="7.5"/><path d="${line}" transform="translate(0 10) scale(1 .5)"/><path d="${line}" transform="translate(0 90) rotate(180 100 50) scale(1 .5)"/>`,
  bendletLined: (line: string) =>
    `<path d="${line}" transform="translate(2 -12) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-22 12) rotate(225 110 100) scale(1.1 1)"/><rect x="0" y="94" width="200" height="12" transform="translate(-10 0) rotate(45 110 100) scale(1.1 1)" stroke="none"/>`,
  bendletSinisterLined: (line: string) =>
    `<path d="${line}" transform="translate(-22 -12) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(2 12) rotate(-225 110 100) scale(1.1 1)"/><rect x="0" y="94" width="200" height="12" transform="translate(-10 0) rotate(-45 110 100) scale(1.1 1)" stroke="none"/>`,
  terraceLined: (line: string) =>
    `<path d="${line}" transform="translate(0,50)"/><rect x="0" y="164" width="200" height="36" stroke="none"/>`,
  crossLined: (line: string) =>
    `<path d="${line}" transform="translate(0,-14.5)"/><path d="${line}" transform="rotate(180 100 100) translate(0,-14.5)"/><path d="${line}" transform="rotate(-90 100 100) translate(0,-14.5)"/><path d="${line}" transform="rotate(-270 100 100) translate(0,-14.5)"/>`,
  crossPartedLined: (line: string) =>
    `<path d="${line}" transform="translate(0,-20)"/><path d="${line}" transform="rotate(180 100 100) translate(0,-20)"/><path d="${line}" transform="rotate(-90 100 100) translate(0,-20)"/><path d="${line}" transform="rotate(-270 100 100) translate(0,-20)"/>`,
  saltireLined: (line: string) =>
    `<path d="${line}" transform="translate(0 -10) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-20 10) rotate(225 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-20 -10) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(0 10) rotate(-225 110 100) scale(1.1 1)"/>`,
  saltirePartedLined: (line: string) =>
    `<path d="${line}" transform="translate(3 -13) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-23 13) rotate(225 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-23 -13) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(3 13) rotate(-225 110 100) scale(1.1 1)"/>`,
};
