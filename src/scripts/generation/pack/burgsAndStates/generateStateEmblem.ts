const {COA} = window;

export function generateStateEmblem(type: string, cultureShield: string) {
  const shield = COA.getShield(cultureShield, null);
  const coa: ICoa = {...COA.generate(null, null, null, type), shield};

  return coa;
}
