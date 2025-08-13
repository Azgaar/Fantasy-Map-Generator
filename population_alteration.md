# Population Alteration Guide

## Overview

This guide explains how to modify the Fantasy Map Generator to reduce settlement population sizes from their default large values (cities ~250k) to more realistic medieval fantasy scales (cities ~30k, towns 1-5k, villages ≤1k).

### Problem Statement
- Default cities are too large (~250k population)
- Towns are oversized for medieval fantasy settings
- Military forces are proportionally too large
- Need more realistic population distribution

### Goals
- Cities: ~25-35k population
- Large ports: ~20-30k population  
- Regional centers: ~10-20k population
- Towns: ~2-8k population
- Villages: ~0.5-3k population

## Current Population System

The population system operates through hierarchical settlement placement and calculation in `modules/burgs-and-states.js`:

### Settlement Hierarchy
1. **Primary Centers**: Capitals and large ports (placed first)
2. **Regional Centers**: Intermediate hubs between primary centers
3. **Towns**: Secondary settlements with hierarchical scoring
4. **Villages**: Smallest settlements

### Population Formula
Base population calculation (line 394):
```javascript
let basePopulation = Math.max(cells.s[i] / 8 + b.i / 1000 + (i % 100) / 1000, 0.1);
```

Hierarchical multipliers (lines 397-410):
- Capitals: ×1.8
- Large ports: ×1.6
- Regional centers: ×1.3
- Regular settlements: Variable based on hierarchical score

Additional modifiers:
- Port bonus: ×1.2 (line 416)
- Random variation: Gaussian distribution (1.8, 2.5, 0.7, 15, 2.5) (line 424)

## Proposed Changes

### 1. Base Population Reduction (Line 394)

**Current:**
```javascript
let basePopulation = Math.max(cells.s[i] / 8 + b.i / 1000 + (i % 100) / 1000, 0.1);
```

**Change to:**
```javascript
let basePopulation = Math.max(cells.s[i] / 80 + b.i / 10000 + (i % 1000) / 10000, 0.01);
```

**Explanation:**
- `/8` → `/80`: Reduces cell score impact by 10x
- `/1000` → `/10000`: Reduces burg index impact by 10x  
- `(i % 100)` → `(i % 1000)`: Increases modulo range for more variation
- `/1000` → `/10000`: Reduces modulo impact by 10x
- `0.1` → `0.01`: Reduces minimum population by 10x

### 2. Hierarchical Multiplier Reduction (Lines 397-410)

**Current:**
```javascript
if (b.capital) {
  basePopulation *= 1.8;
} else if (b.isLargePort) {
  basePopulation *= 1.6;
} else if (b.isRegionalCenter) {
  basePopulation *= 1.3;
}
```

**Change to:**
```javascript
if (b.capital) {
  basePopulation *= 1.4;
} else if (b.isLargePort) {
  basePopulation *= 1.3;
} else if (b.isRegionalCenter) {
  basePopulation *= 1.2;
}
```

### 3. Hierarchical Score Adjustment (Lines 407-408)

**Current:**
```javascript
const hierarchicalMultiplier = 0.7 + (b.hierarchicalScore / maxHierarchicalScore) * 0.6;
```

**Change to:**
```javascript
const hierarchicalMultiplier = 0.8 + (b.hierarchicalScore / maxHierarchicalScore) * 0.4;
```

### 4. Port Bonus Reduction (Line 416)

**Current:**
```javascript
b.population = b.population * 1.2;
```

**Change to:**
```javascript
b.population = b.population * 1.05;
```

### 5. Random Variation Reduction (Line 424)

**Current:**
```javascript
b.population = rn(b.population * gauss(1.8, 2.5, 0.7, 15, 2.5), 3);
```

**Change to:**
```javascript
b.population = rn(b.population * gauss(1.2, 1.5, 0.5, 5, 1.5), 3);
```

**Explanation:**
- Mean: 1.8 → 1.2 (lower average multiplier)
- Standard deviation: 2.5 → 1.5 (less variation)
- Min: 0.7 → 0.5 (lower minimum)
- Max: 15 → 5 (much lower maximum)
- Sigma: 2.5 → 1.5 (tighter distribution)

## Complete Code Replacement

Replace lines 394-424 in `modules/burgs-and-states.js` with:

```javascript
// Calculate base population (reduced scale)
let basePopulation = Math.max(cells.s[i] / 80 + b.i / 10000 + (i % 1000) / 10000, 0.01);

// Apply reduced hierarchical multipliers
if (b.capital) {
  basePopulation *= 1.4; // Capitals ~30k
} else if (b.isLargePort) {
  basePopulation *= 1.3; // Large ports ~20-25k
} else if (b.isRegionalCenter) {
  basePopulation *= 1.2; // Regional centers ~10-15k
} else if (b.hierarchicalScore) {
  const maxHierarchicalScore = Math.max(...pack.burgs.filter(burg => burg.hierarchicalScore).map(burg => burg.hierarchicalScore));
  if (maxHierarchicalScore > 0) {
    const hierarchicalMultiplier = 0.8 + (b.hierarchicalScore / maxHierarchicalScore) * 0.4;
    basePopulation *= hierarchicalMultiplier;
  }
}

b.population = rn(basePopulation, 3);

if (b.port && !b.isLargePort) {
  b.population = b.population * 1.05; // Minimal port bonus
}

// Reduced random variation
b.population = rn(b.population * gauss(1.2, 1.5, 0.5, 5, 1.5), 3);
```

## Expected Results

### Population Ranges
| Settlement Type | Current Range | New Range | Reduction Factor |
|----------------|---------------|-----------|------------------|
| Capitals | 200k-300k+ | 25k-35k | ~8-10x |
| Large Ports | 150k-250k | 20k-30k | ~7-8x |
| Regional Centers | 100k-150k | 10k-20k | ~8-10x |
| Major Towns | 20k-50k | 3k-8k | ~6-8x |
| Towns | 5k-20k | 1k-5k | ~5-6x |
| Villages | 1k-5k | 0.5k-3k | ~2-3x |

### Population Distribution
- More realistic medieval fantasy scale
- Maintains hierarchical relationships
- Preserves population density gradients around major centers
- Keeps relative differences between settlement types

## Military Impact

Military forces scale directly with population, so expect proportional reductions:

### Army Size Changes
| Settlement Type | Current Military | New Military | 
|----------------|------------------|--------------|
| Capitals | 500-1000 troops | 60-120 troops |
| Large Ports | 300-500 troops | 40-70 troops |
| Regional Centers | 200-300 troops | 25-40 troops |
| Major Towns | 40-100 troops | 6-15 troops |
| Towns | 10-40 troops | 2-8 troops |
| Villages | 2-10 troops | 1-3 troops |

### Military Realism
- More historically accurate army sizes
- Medieval-scale battles (hundreds vs thousands)
- Realistic garrison sizes for settlements
- Proportional naval forces for ports

## Implementation Steps

1. **Backup Original File**
   ```bash
   cp modules/burgs-and-states.js modules/burgs-and-states.js.backup
   ```

2. **Locate Target Code**
   - Open `modules/burgs-and-states.js`
   - Find the `specifyBurgs` function (starts around line 375)
   - Locate the population calculation section (lines 394-424)

3. **Make Changes**
   - Replace the code block as specified above
   - Verify syntax and formatting
   - Save the file

4. **Test Changes**
   - Generate a new map
   - Check settlement populations in the editor
   - Verify hierarchical relationships are maintained
   - Check military generation results

5. **Fine-Tune if Needed**
   - Adjust division factors if populations are still too high/low
   - Modify multipliers if hierarchy isn't balanced
   - Tweak random variation parameters if needed

## Testing & Validation

### Population Validation
1. Generate a new map with default settings
2. Check capital cities are in 25k-35k range
3. Verify towns are in 1k-8k range
4. Confirm villages are under 3k
5. Ensure hierarchical relationships are preserved

### Military Validation
1. Enable military generation
2. Check that regiment sizes are proportional
3. Verify capitals have reasonable garrison sizes (60-120 troops)
4. Confirm naval units are only in appropriate ports

### Edge Case Testing
- Very small maps (few settlements)
- Very large maps (many settlements) 
- Different culture/biome combinations
- Various state types (Naval, Highland, etc.)

## Troubleshooting

### Common Issues

**Populations Still Too High**
- Increase division factors further (e.g., /80 → /120)
- Reduce multipliers more (e.g., 1.4 → 1.3 for capitals)

**Populations Too Low**
- Reduce division factors (e.g., /80 → /60)
- Increase minimum population (e.g., 0.01 → 0.02)

**Hierarchy Not Preserved**
- Adjust multiplier ratios between settlement types
- Check that hierarchical score calculation is working

**Military Too Small**
- Military scales automatically with population
- Consider adjusting `populationRate` in military settings if needed

## Rollback Instructions

If changes cause issues:

1. **Restore Backup**
   ```bash
   cp modules/burgs-and-states.js.backup modules/burgs-and-states.js
   ```

2. **Verify Restoration**
   - Generate a test map
   - Check populations are back to original scale
   - Confirm military generation works normally

## Advanced Customization

### Further Adjustments

**Ultra-Small Scale** (cities ~10k):
- Use division factor of /200 instead of /80
- Reduce multipliers to 1.2, 1.15, 1.1
- Set minimum to 0.005

**Moderate Scale** (cities ~50k):
- Use division factor of /40 instead of /80  
- Keep multipliers at 1.6, 1.4, 1.25
- Adjust random variation accordingly

### Custom Settlement Types
Consider adding new settlement categories:
- Metropolis (very rare, 50k+)
- Hamlet (very common, <500)
- Outpost (frontier settlements, <200)

## Conclusion

These changes will create a more realistic population distribution suitable for medieval fantasy settings while maintaining the hierarchical settlement system and all existing functionality. Military forces will scale appropriately, creating more believable army sizes for the generated world.