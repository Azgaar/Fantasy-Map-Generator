// ported from Armoria (https://github.com/Azgaar/Armoria), keep in sync
export interface Template {
  template: string;
  templateLined?: (line: string) => string;
}

export const divisionTemplates: Record<string, Template> = {
  chevronny: {
    template:
      '<path d="M0,80 100,-15 200,80 200,120 100,25 0,120z M0,160 100,65 200,160 200,200 100,105 0,200z M0,240 100,145 200,240 0,240z"/>'
  },
  gyronny: { template: '<polygon points="0,0 200,200 200,100 0,100"/><polygon points="200,0 0,200 100,200 100,0"/>' },
  gyronnyOfSixPerFess: {
    template: '<polygon points="0,100 200,100 200,200 157.7,200 42.3,0 157.7,0 42.3,200 0,200"/>'
  },
  gyronnyOfSixPerPale: {
    template: '<polygon points="100,0 100,200 200,200 200,157.7 0,42.3 0,157.7 200,42.3 200,0"/>'
  },
  gyronnyOfTenPerFess: {
    template:
      '<polygon points="0,100 200,100 200,27.3 0,172.7 0,200 67.5,200 132.5,0 67.5,0 132.5,200 200,200 200,172.7 0,27.3"/>'
  },
  gyronnyOfTenPerPale: {
    template:
      '<polygon points="100,0 100,200 27.3,200 172.7,0 200,0 200,67.5 0,132.5 0,67.5 200,132.5 200,200 172.7,200 27.3,0"/>'
  },
  gyronnyOfTwelve: {
    template:
      '<polygon points="100,0 100,200 157.7,200 42.3,0"/><polygon points="0,100 200,100 200,157.7 0,42.3"/><polygon points="0,157.7 0,200 42.3,200 157.7,0 200,0 200,42.3"/>'
  },
  perBend: {
    template: '<polygon points="0,0 200,200 0,200"/>',
    templateLined: line => `<path d="${line} V200 H0 Z" transform="translate(-10 -10) rotate(45 110 110) scale(1.1)"/>`
  },
  perBendSinister: {
    template: '<polygon points="200,0 0,200 200,200"/>',
    templateLined: line => `<path d="${line} V200 H0 Z" transform="translate(-10 -10) rotate(-45 110 110) scale(1.1)"/>`
  },
  perChevron: {
    template: '<polygon points="0,200 100,100 200,200"/>',
    templateLined: line =>
      `<path d="${line} L100,200 Z" transform="translate(129 71) rotate(-45 -100 100) scale(-1 1)"/><path d="${line} L100,200 Z" transform="translate(71 71) rotate(45 100 100)"/>`
  },
  perChevronReversed: {
    template: '<polygon points="0,0 100,100 200,0"/>',
    templateLined: line =>
      `<path d="${line} L100,200 Z" transform="translate(-70.7 -70.7) rotate(225 100 100)"/><path d="${line} L100,200 Z" transform="translate(270.7 -70.7) rotate(-225 -100 100) scale(-1 1)"/>`
  },
  perCross: {
    template: '<rect x="100" y="0" width="100" height="100"/><rect x="0" y="100" width="100" height="100"/>',
    templateLined: line =>
      `<path d="${line} V400 H0 Z" transform="translate(0 50) scale(.5)"/><path d="${line} V400 H0 Z" transform="translate(200 150) scale(-.5)"/>`
  },
  perFess: {
    template: '<rect x="0" y="100" width="200" height="100"/>',
    templateLined: line => `<path d="${line} V200 H0 Z"/>`
  },
  perPale: {
    template: '<rect x="100" y="0" width="100" height="200"/>',
    templateLined: line => `<path d="${line} V200 H0 Z" transform="rotate(-90 100 100)"/>`
  },
  perPile: {
    template: '<polygon points="0,0 15,0 100,200 185,0 200,0 200,200 0,200"/>',
    templateLined: line =>
      `<path d="${line} V200 H0 Z" transform="translate(161.66 10) rotate(66.66 -100 100) scale(-1 1)"/><path d="${line} V200 H0 Z" transform="translate(38.33 10) rotate(-66.66 100 100)"/>`
  },
  perSaltire: { template: '<polygon points="0,0 0,200 200,0 200,200"/>' }
};

export const ordinaryTemplates: Record<string, Template> = {
  bar: {
    template: '<rect x="0" y="87.5" width="200" height="25"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0,-12.5)"/><path d="${line}" transform="translate(0,12.5) rotate(180.00001 100 100)"/><rect x="0" y="94" width="200" height="12" stroke="none"/>`
  },
  bend: {
    template: '<polygon points="35,0 200,165 200,200 165,200 0,35 0,0"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(8 -18) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-28 18) rotate(225 110 100) scale(1.1 1)"/><rect x="0" y="88" width="200" height="24" transform="translate(-10 0) rotate(45 110 100) scale(1.1 1)" stroke="none"/>`
  },
  bendSinister: {
    template: '<polygon points="0,165 165,0 200,0 200,35 35,200 0,200"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(-28 -18) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(8 18) rotate(-225 110 100) scale(1.1 1)"/><rect x="0" y="88" width="200" height="24" transform="translate(-10 0) rotate(-45 110 100) scale(1.1 1)" stroke="none"/>`
  },
  bendlet: {
    template: '<polygon points="22,0 200,178 200,200 178,200 0,22 0,0"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(2 -12) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-22 12) rotate(225 110 100) scale(1.1 1)"/><rect x="0" y="94" width="200" height="12" transform="translate(-10 0) rotate(45 110 100) scale(1.1 1)" stroke="none"/>`
  },
  bendletSinister: {
    template: '<polygon points="0,178 178,0 200,0 200,22 22,200 0,200"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(-22 -12) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(2 12) rotate(-225 110 100) scale(1.1 1)"/><rect x="0" y="94" width="200" height="12" transform="translate(-10 0) rotate(-45 110 100) scale(1.1 1)" stroke="none"/>`
  },
  canton: { template: '<rect width="75" height="75"/>' },
  chevron: { template: '<polygon points="0,125 100,60 200,125 200,165 100,100 0,165"/>' },
  chevronReversed: { template: '<polygon points="0,75 100,140 200,75 200,35 100,100 0,35"/>' },
  chief: {
    template: '<rect width="200" height="75"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0,-25) rotate(180.00001 100 100)"/><rect width="200" height="62" stroke="none"/>`
  },
  cross: {
    template: '<polygon points="85,0 85,85 0,85 0,115 85,115 85,200 115,200 115,115 200,115 200,85 115,85 115,0"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0 -14.5)"/><path d="${line}" transform="rotate(180 100 100) translate(0 -14.5)"/><path d="${line}" transform="rotate(-90 100 100) translate(0 -14.5)"/><path d="${line}" transform="rotate(-270 100 100) translate(0 -14.5)"/>`
  },
  crossParted: {
    template:
      '<path d="M 80 0 L 80 80 L 0 80 L 0 95 L 80 95 L 80 105 L 0 105 L 0 120 L 80 120 L 80 200 L 95 200 L 95 120 L 105 120 L 105 200 L 120 200 L 120 120 L 200 120 L 200 105 L 120 105 L 120 95 L 200 95 L 200 80 L 120 80 L 120 0 L 105 0 L 105 80 L 95 80 L 95 0 L 80 0 z M 95 95 L 105 95 L 105 105 L 95 105 L 95 95 z"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0 -20)"/><path d="${line}" transform="rotate(180 100 100) translate(0 -20)"/><path d="${line}" transform="rotate(-90 100 100) translate(0 -20)"/><path d="${line}" transform="rotate(-270 100 100) translate(0 -20)"/>`
  },
  fess: {
    template: '<rect x="0" y="75" width="200" height="50"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0 -25)"/><path d="${line}" transform="translate(0 25) rotate(180 100 100)"/><rect x="0" y="88" width="200" height="24" stroke="none"/>`
  },
  fessCotissed: {
    template:
      '<rect x="0" y="67" width="200" height="8"/><rect x="0" y="83" width="200" height="34"/><rect x="0" y="125" width="200" height="8"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0 15) scale(1 .5)"/><path d="${line}" transform="translate(0 85) rotate(180 100 50) scale(1 .5)"/><rect x="0" y="80" width="200" height="40"/>`
  },
  fessDoubleCotissed: {
    template:
      '<rect x="0" y="60" width="200" height="7.5"/><rect x="0" y="72.5" width="200" height="7.5"/><rect x="0" y="85" width="200" height="30"/><rect x="0" y="120" width="200" height="7.5"/><rect x="0" y="132.5" width="200" height="7.5"/>',
    templateLined: line =>
      `<rect x="0" y="85" width="200" height="30"/><rect x="0" y="72.5" width="200" height="7.5"/><rect x="0" y="120" width="200" height="7.5"/><path d="${line}" transform="translate(0 10) scale(1 .5)"/><path d="${line}" transform="translate(0 90) rotate(180 100 50) scale(1 .5)"/>`
  },
  flaunches: { template: '<path d="M0,0 q120,100 0,200 M200,0 q-120,100 0,200"/>' },
  gemelle: {
    template: '<rect x="0" y="76" width="200" height="16"/><rect x="0" y="108" width="200" height="16"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0,-22.5)"/><path d="${line}" transform="translate(0,22.5) rotate(180.00001 100 100)"/>`
  },
  gore: { template: '<path d="M20,0 Q30,75 100,100 Q80,150 100,200 L0,200 L0,0 Z"/>' },
  gyron: { template: '<polygon points="0,0 100,100 0,100"/>' },
  label: {
    template:
      '<path d="m 46,54.8 6.6,-15.6 95.1,0 5.9,15.5 -16.8,0.1 4.5,-11.8 L 104,43 l 4.3,11.9 -16.8,0 4.3,-11.8 -37.2,0 4.5,11.8 -16.9,0 z"/>'
  },
  mount: { template: '<path d="m0,250 a100,100,0,0,1,200,0"/>' },
  pale: {
    template: '<rect x="75" y="0" width="50" height="200"/>',
    templateLined: line =>
      `<path d="${line}" transform="rotate(-90 100 100) translate(0 -25)"/><path d="${line}" transform="rotate(90 100 100) translate(0 -25)"/><rect x="88" y="0" width="24" height="200" stroke="none"/>`
  },
  pall: { template: '<polygon points="0,0 30,0 100,70 170,0 200,0 200,30 122,109 122,200 78,200 78,109 0,30"/>' },
  pallReversed: {
    template: '<polygon points="0,200 0,170 78,91 78,0 122,0 122,91 200,170 200,200 170,200 100,130 30,200"/>'
  },
  pile: { template: '<polygon points="70,0 100,175 130,0"/>' },
  pileInBend: { template: '<polygon points="200,200 200,144 25,25 145,200"/>' },
  pileInBendSinister: { template: '<polygon points="0,200 0,144 175,25 55,200"/>' },
  piles: { template: '<polygon points="46,0 75,175 103,0"/><polygon points="95,0 125,175 154,0"/>' },
  pilesInPoint: { template: '<path d="M15,0 100,200 60,0Z M80,0 100,200 120,0Z M140,0 100,200 185,0Z"/>' },
  point: { template: '<path d="M0,200 Q80,180 100,135 Q120,180 200,200"/>' },
  quarter: { template: '<rect width="100" height="100"/>' },
  saltire: {
    template:
      '<path d="M 0,21 79,100 0,179 0,200 21,200 100,121 179,200 200,200 200,179 121,100 200,21 200,0 179,0 100,79 21,0 0,0 Z"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0 -10) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-20 10) rotate(225 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-20 -10) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(0 10) rotate(-225 110 100) scale(1.1 1)"/>`
  },
  saltireParted: {
    template:
      '<path d="M 7 0 L 89 82 L 82 89 L 0 7 L 0 28 L 72 100 L 0 172 L 0 193 L 82 111 L 89 118 L 7 200 L 28 200 L 100 128 L 172 200 L 193 200 L 111 118 L 118 111 L 200 193 L 200 172 L 128 100 L 200 28 L 200 7 L 118 89 L 111 82 L 193 0 L 172 0 L 100 72 L 28 0 L 7 0 z M 100 93 L 107 100 L 100 107 L 93 100 L 100 93 z"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(3 -13) rotate(45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-23 13) rotate(225 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(-23 -13) rotate(-45 110 100) scale(1.1 1)"/><path d="${line}" transform="translate(3 13) rotate(-225 110 100) scale(1.1 1)"/>`
  },
  terrace: {
    template: '<rect x="0" y="145" width="200" height="55"/>',
    templateLined: line =>
      `<path d="${line}" transform="translate(0,50)"/><rect x="0" y="164" width="200" height="36" stroke="none"/>`
  }
};
