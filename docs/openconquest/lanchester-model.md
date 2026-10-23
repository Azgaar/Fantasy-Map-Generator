# Lanchester Combat Models: Core Laws for Wargame Simulation

> **Mathematical foundations of attrition, numerical advantage, and combat resolution in OpenConquest.**

---

## Overview

Frederick W. Lanchester published his pioneering mathematical models of military combat in 1916 (*Aircraft in Warfare: The Dawn of the Fourth Arm*). Lanchester's equations model how the relative combat power, lethalities, and headcounts of two opposing forces determine casualty rates and operational outcomes over time.

In grand-strategy and operational wargaming, Lanchester's equations provide the foundational calculus for:
1. **Auto-resolve battle simulation**: Predicting attrition without running physics-level unit simulations.
2. **Terrain & fortification effects**: Modeling how defensive chokepoints compress engagement frontage.
3. **Combined arms & tactical archetypes**: Balancing melee shock lines against direct-fire missile units and indirect artillery barrages.

---

## 1. Lanchester's Linear Law (Ancient / Unaimed Combat)

### Operational Context
Lanchester's Linear Law governs combat scenarios where:
- **Melee engagements & limited frontage**: Ancient and medieval shock combat (e.g. hoplite phalanxes, shield walls, 1-on-1 front-rank duels) where only a fixed number of soldiers can contact the enemy at a given moment. Rear ranks cannot engage simultaneously; they merely feed replacements into the fighting line.
- **Unaimed area fire**: Indirect arrow volleys over high battlements or artillery barrages into blind sectors where shots are distributed randomly across a target area rather than sighted at specific individuals.

### Mathematical Formulation
In unaimed area combat between Blue ($B$) and Red ($R$), the probability of any given projectile striking an enemy is proportional to the target army's density across the area. 

When combat is limited by contact frontage or unguided area dispersion, casualty accumulation takes the linear differential form:

$$\frac{dB}{dt} = -k_R \cdot R \cdot B$$

$$\frac{dR}{dt} = -k_B \cdot B \cdot R$$

Where active front-line combatants are constrained by terrain frontage $W$, the rate of enemy casualties depends strictly on the fighting quality and number of active combatants on the line:

$$\frac{dB}{dt} = -b \cdot R_{\text{active}} \qquad \text{and} \qquad \frac{dR}{dt} = -a \cdot B_{\text{active}}$$

Dividing the two rates yields:

$$\frac{dB}{dR} = \frac{k_R}{k_B} \quad \implies \quad k_B (B_0 - B(t)) = k_R (R_0 - R(t))$$

### Scaling Properties & Consequences
- **Linear Scaling ($N$)**: Doubling the size of your force doubles its overall fighting endurance and total sustained combat power linearly.
- **The Equal-Exchange Dynamic**: Superior numbers do not confer an exponential kill rate. If 2,000 spearmen fight 1,000 identical spearmen in a narrow valley with equal frontages, the larger force wins with approximately 1,000 survivors remaining. Quality ($k$) trades directly 1:1 against quantity ($N$).

---

## 2. Lanchester's Square Law (Modern / Aimed Combat)

### Operational Context
Lanchester's Square Law governs engagements where:
- **Direct, aimed fire**: Combatants can acquire, sight, and engage individual targets simultaneously without interference from friendly ranks.
- **Concentration of fire**: Multiple shooters can focus their fire on the same target, rapidly eliminating enemy combatants and removing their return fire from the engagement.
- **Rapid target reallocation**: As soon as a target is incapacitated, shooters immediately shift aim to the next visible foe.

In fantasy and historical contexts, this applies to open-field archer lines with clear lines of sight, crossfire musketry, naval broadsides, and focused magic/artillery salvoes.

### Mathematical Formulation
Let Blue force size be $B(t)$ with individual lethal firing efficiency $b$, and Red force size be $R(t)$ with firing efficiency $a$. Because all surviving units can fire simultaneously at visible targets:

$$\frac{dB}{dt} = -a \cdot R(t)$$

$$\frac{dR}{dt} = -b \cdot B(t)$$

Dividing the differential equations:

$$\frac{dB}{dR} = \frac{a \cdot R}{b \cdot B} \quad \implies \quad b \cdot B \, dB = a \cdot R \, dR$$

Integrating from time $t_0$ to $t$ reveals **Lanchester's State Invariant**:

$$b \left( B_0^2 - B(t)^2 \right) = a \left( R_0^2 - R(t)^2 \right)$$

The overall fighting strength (Combat Power, $P$) of a force scales according to:

$$\text{Combat Power} \propto \text{Efficiency} \times (\text{Headcount})^2$$

$$P_B = b \cdot B^2 \qquad \text{and} \qquad P_R = a \cdot R^2$$

### The Squared Advantage (Exponential Multiplication)
Because numerical superiority is squared:
- **Doubling force size ($2\times$) quadruples combat power ($4\times$)**:
  $$2^2 = 4$$
- **A 3:1 numerical ratio yields a 9:1 advantage in combat power**:
  $$3^2 = 9$$
- **Asymmetric Losses**: In a battle where Force Blue has 2,000 archers and Force Red has 1,000 archers of equal skill ($a = b$):
  $$B_{\text{surviving}} = \sqrt{B_0^2 - R_0^2} = \sqrt{2000^2 - 1000^2} = \sqrt{3,000,000} \approx 1,732$$
  Force Blue eliminates the entire 1,000-man Red army while losing only **268 men** (~13% casualties), despite being outnumbered only 2:1 initially.

---

## 3. Comparison of Core Laws

| Dimension | Lanchester Linear Law | Lanchester Square Law |
|---|---|---|
| **Combat Type** | Melee, duels, phalanxes, unaimed area fire | Aimed missile fire, direct crossfire, broadsides |
| **Targeting** | 1-on-1 contact or blind dispersion | Multiple shooters concentrating on sighted targets |
| **Governing ODEs** | $\frac{dB}{dt} = -k_R \cdot R \cdot B$ or $-b \cdot R_{\text{front}}$ | $\frac{dB}{dt} = -a \cdot R$ |
| **Power Scaling** | Linear: $P \propto k \cdot N$ | Quadratic: $P \propto k \cdot N^2$ |
| **Doubling Advantage** | $2\times$ numbers $\implies$ $2\times$ combat power | $2\times$ numbers $\implies$ $4\times$ combat power |
| **Losses on 2:1 Odds** | Winner loses 50% of starting force | Winner loses ~13.4% of starting force |
| **Tactical Counter** | Chokepoints, narrow mountain passes, dense shields | Defilade, fortifications, line-of-sight obstruction, smoke |

---

## 4. Application in the OpenConquest Wargame Engine

OpenConquest implements these dynamics inside its statistical auto-resolve engine ([`src/conquest/engine/game/battle.ts`](file:///C:/Users/ellsworthnm/Documents/Fantasy-Map-Generator/src/conquest/engine/game/battle.ts)):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tactical Engagement Mix                         │
│                                                                        │
│   Melee Shock Troops                       Ranged & Direct Fire        │
│   (Frontage / Linear Dynamics)            (Aimed / Square Dynamics)    │
│   ┌───────────────────────────┐           ┌────────────────────────┐   │
│   │ • Spearmen, Swordsmen     │           │ • Archers, Crossbowmen │   │
│   │ • Front-rank bottleneck   │  VS       │ • Unobstructed line of │   │
│   │ • Constrained by terrain  │           │   sight target focus   │   │
│   └─────────────┬─────────────┘           └───────────┬────────────┘   │
│                 │                                     │                │
│                 ▼                                     ▼                │
│         Linear Rate: O(N)                     Square Rate: O(N²)       │
│                 │                                     │                │
│                 └──────────────┬──────────────────────┘                │
│                                ▼                                       │
│                 Effective Blended Power & Attrition                     │
│                 (Walls, River Crossings, Encampment)                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Mixed Category Dynamics (Blended Matchups)
In fantasy armies, forces combine melee frontlines (governed by Linear constraints) with ranged archers and artillery (governed by Square laws).
- OpenConquest evaluates unit power per category:
  $$\text{unitPower} = (\text{attack} + \text{defense} + \text{charge}/2 + \text{missile} \times 0.6) \times \text{expMult} \times \text{fill}$$
- Category interaction weights (`MATCHUP`) scale efficiency based on the composition mix:
  - **Cavalry vs. Ranged ($\times 1.3$)**: Cavalry breaches engagement distance rapidly, converting ranged square-law superiority into melee linear attrition.
  - **Ranged vs. Slow Melee ($\times 1.1$)**: Sustained direct fire exploits square-law concentration before melee lines meet.
  - **Spears vs. Cavalry ($\times 0.8$)**: Fortified spear walls neutralize charge speed and compress cavalry into close quarters.

### 2. Terrain & Fortifications as Frontage Bottlenecks
Under pure Square Law conditions, a large army will annihilate a smaller army with negligible losses. Fortifications and terrain features alter the mathematical regime:
- **Fortification Walls (`walls > 0`)**: Imposes defensive combat multipliers ($+30\%$ per tier), absorbing incoming missile focus and restricting assaults to breach points (forcing attacking hordes to fight through linear-bottleneck breaches).
- **River Crossings (`attackerCrossedRiver`)**: Imposes an attacker penalty, simulating disordered wading where units cannot focus fire or coordinate frontage.
- **Entrenchment (`defenderEncamped`)**: Grants $+10\%$ defense bonus and limits the attacker's line-of-sight targeting advantages.

### 3. The Attrition & Rout Mechanics
In [`src/conquest/engine/game/battle.ts`](file:///C:/Users/ellsworthnm/Documents/Fantasy-Map-Generator/src/conquest/engine/game/battle.ts):
```ts
const aEff = effectivePower(attackerUnits, defenderUnits, attackerMult, types);
const dEff = effectivePower(defenderUnits, attackerUnits, defenderMult, types);
const totalEff = aEff + dEff;

// Stronger side inflicts more loss pressure (Lanchester-flavored)
const aLossRate = Math.min(0.45, (dEff / totalEff) * pressure);
const dLossRate = Math.min(0.45, (aEff / totalEff) * pressure);
```
- Attrition scales proportionally with the opponent's relative share of effective power.
- Armies break when reduced below `routThreshold` (default $25\%$), preventing mathematically total annihilation while preserving the decisive advantage of concentrated force.

---

## References

1. Lanchester, F. W. (1916). *Aircraft in Warfare: The Dawn of the Fourth Arm*. Constable and Company, London.
2. Taylor, J. G. (1983). *Lanchester Models of Warfare*. Volumes I & II, Military Operations Research Society of America.
3. Deitchman, S. J. (1962). *A Lanchester Model of Guerrilla Warfare*. Operations Research, 10(6), 818–827.
4. OpenConquest Architecture: [`docs/openconquest/README.md`](README.md).
