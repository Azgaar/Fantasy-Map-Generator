# TypeScript Error Cataloging Scripts

## Overview

This directory contains scripts for analyzing and cataloging TypeScript errors in the Fantasy Map Generator codebase.

## catalog-errors.ts

A script that runs `tsc --noEmit` to capture TypeScript errors, parses them into structured JSON format, categorizes them, and generates reports.

### Usage

```bash
npm run catalog-errors
```

### Output Files

The script generates two files in the project root:

1. **error-catalog.json** - Structured JSON catalog containing:
   - Timestamp of analysis
   - Total error count
   - Array of all errors with file, line, column, code, message, category, and severity
   - Errors grouped by category
   - Errors grouped by file

2. **error-report.txt** - Human-readable report containing:
   - Summary statistics
   - Error counts by category
   - Error counts by file (sorted by count)
   - Detailed error listings organized by category

### Error Categories

The script categorizes errors into the following types:

- **implicit-any**: Variables or parameters without explicit type annotations (TS7006, TS7031, TS7034)
- **node-protocol**: Missing 'node:' prefix for Node.js built-in module imports
- **type-conversion**: Type assignment and conversion issues
- **unused-parameter**: Parameters not used in function bodies (TS6133)
- **dynamic-import**: Dynamic namespace import access issues
- **type-compatibility**: Type compatibility mismatches (TS2345, TS2322)
- **global-conflict**: Global variable type declaration conflicts
- **other**: Uncategorized errors

### Example Output

```
================================================================================
Summary
================================================================================
Total Errors: 223

By Category:
  implicit-any: 180
  type-conversion: 5
  type-compatibility: 3
  other: 35

Top 5 Files by Error Count:
  src/modules/states-generator.ts: 40
  src/modules/provinces-generator.ts: 39
  src/modules/zones-generator.ts: 32
  src/modules/burgs-generator.ts: 18
  src/modules/religions-generator.ts: 17
```

## Integration with Cleanup Process

This cataloging infrastructure supports the systematic TypeScript cleanup effort by:

1. Providing baseline error counts before cleanup begins
2. Enabling progress tracking as errors are resolved
3. Identifying error patterns and priorities
4. Supporting automated validation after fixes are applied

Run the script periodically during cleanup to track progress and verify that fixes are reducing the error count without introducing new issues.
