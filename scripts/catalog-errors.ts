#!/usr/bin/env node
/**
 * TypeScript Error Cataloging Script
 * 
 * This script runs `tsc --noEmit` to capture TypeScript errors,
 * parses them into structured JSON format, categorizes them,
 * and generates a report showing counts by category and file.
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

enum ErrorCategory {
  ImplicitAny = 'implicit-any',
  NodeProtocol = 'node-protocol',
  TypeConversion = 'type-conversion',
  UnusedParameter = 'unused-parameter',
  DynamicImport = 'dynamic-import',
  TypeCompatibility = 'type-compatibility',
  GlobalConflict = 'global-conflict',
  Other = 'other'
}

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: 'error' | 'warning';
}

interface ErrorCatalog {
  timestamp: string;
  totalErrors: number;
  errors: TypeScriptError[];
  errorsByCategory: Record<ErrorCategory, TypeScriptError[]>;
  errorsByFile: Record<string, TypeScriptError[]>;
}

/**
 * Categorize a TypeScript error based on its code and message
 */
function categorizeError(code: string, message: string): ErrorCategory {
  // Implicit any types
  if (code === 'TS7006' || code === 'TS7031' || code === 'TS7034') {
    return ErrorCategory.ImplicitAny;
  }
  
  // Node.js import protocol issues
  if (message.includes("'node:'") || message.includes('node protocol')) {
    return ErrorCategory.NodeProtocol;
  }
  
  // Type conversion issues
  if (message.includes('Type') && (message.includes('is not assignable to') || message.includes('conversion'))) {
    return ErrorCategory.TypeConversion;
  }
  
  // Unused parameters
  if (code === 'TS6133' && message.includes('parameter')) {
    return ErrorCategory.UnusedParameter;
  }
  
  // Dynamic import/namespace access
  if (message.includes('dynamic') || message.includes('namespace')) {
    return ErrorCategory.DynamicImport;
  }
  
  // Type compatibility
  if (code === 'TS2345' || code === 'TS2322') {
    return ErrorCategory.TypeCompatibility;
  }
  
  // Global variable conflicts
  if (message.includes('global') || message.includes('duplicate')) {
    return ErrorCategory.GlobalConflict;
  }
  
  return ErrorCategory.Other;
}

/**
 * Parse TypeScript compiler output into structured errors
 */
function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];
  const lines = output.split('\n');
  
  // TypeScript error format: file(line,column): error TSxxxx: message
  const errorPattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/;
  
  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [, file, lineNum, column, severity, code, message] = match;
      errors.push({
        file: file.trim(),
        line: parseInt(lineNum, 10),
        column: parseInt(column, 10),
        code,
        message: message.trim(),
        category: categorizeError(code, message),
        severity: severity as 'error' | 'warning'
      });
    }
  }
  
  return errors;
}

/**
 * Group errors by category
 */
function groupByCategory(errors: TypeScriptError[]): Record<ErrorCategory, TypeScriptError[]> {
  const grouped: Record<ErrorCategory, TypeScriptError[]> = {
    [ErrorCategory.ImplicitAny]: [],
    [ErrorCategory.NodeProtocol]: [],
    [ErrorCategory.TypeConversion]: [],
    [ErrorCategory.UnusedParameter]: [],
    [ErrorCategory.DynamicImport]: [],
    [ErrorCategory.TypeCompatibility]: [],
    [ErrorCategory.GlobalConflict]: [],
    [ErrorCategory.Other]: []
  };
  
  for (const error of errors) {
    grouped[error.category].push(error);
  }
  
  return grouped;
}

/**
 * Group errors by file
 */
function groupByFile(errors: TypeScriptError[]): Record<string, TypeScriptError[]> {
  const grouped: Record<string, TypeScriptError[]> = {};
  
  for (const error of errors) {
    if (!grouped[error.file]) {
      grouped[error.file] = [];
    }
    grouped[error.file].push(error);
  }
  
  return grouped;
}

/**
 * Generate a human-readable report
 */
function generateReport(catalog: ErrorCatalog): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('TypeScript Error Catalog Report');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Generated: ${catalog.timestamp}`);
  lines.push(`Total Errors: ${catalog.totalErrors}`);
  lines.push('');
  
  // Errors by category
  lines.push('-'.repeat(80));
  lines.push('Errors by Category');
  lines.push('-'.repeat(80));
  lines.push('');
  
  for (const [category, errors] of Object.entries(catalog.errorsByCategory)) {
    if (errors.length > 0) {
      lines.push(`${category}: ${errors.length} errors`);
    }
  }
  lines.push('');
  
  // Errors by file
  lines.push('-'.repeat(80));
  lines.push('Errors by File');
  lines.push('-'.repeat(80));
  lines.push('');
  
  const sortedFiles = Object.entries(catalog.errorsByFile)
    .sort((a, b) => b[1].length - a[1].length);
  
  for (const [file, errors] of sortedFiles) {
    lines.push(`${file}: ${errors.length} errors`);
  }
  lines.push('');
  
  // Detailed error list by category
  lines.push('-'.repeat(80));
  lines.push('Detailed Errors by Category');
  lines.push('-'.repeat(80));
  lines.push('');
  
  for (const [category, errors] of Object.entries(catalog.errorsByCategory)) {
    if (errors.length > 0) {
      lines.push('');
      lines.push(`## ${category} (${errors.length} errors)`);
      lines.push('');
      
      for (const error of errors) {
        lines.push(`  ${error.file}(${error.line},${error.column}): ${error.code}`);
        lines.push(`    ${error.message}`);
        lines.push('');
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Main execution
 */
function main() {
  console.log('Running TypeScript compiler to capture errors...');
  
  let output = '';
  try {
    // Run tsc --noEmit and capture output
    execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
    console.log('No TypeScript errors found!');
    output = '';
  } catch (error: any) {
    // tsc exits with non-zero code when errors exist
    output = error.stdout || error.stderr || '';
  }
  
  console.log('Parsing errors...');
  const errors = parseTypeScriptErrors(output);
  
  console.log('Categorizing errors...');
  const errorsByCategory = groupByCategory(errors);
  const errorsByFile = groupByFile(errors);
  
  const catalog: ErrorCatalog = {
    timestamp: new Date().toISOString(),
    totalErrors: errors.length,
    errors,
    errorsByCategory,
    errorsByFile
  };
  
  // Write JSON catalog
  const jsonPath = resolve(process.cwd(), 'error-catalog.json');
  writeFileSync(jsonPath, JSON.stringify(catalog, null, 2));
  console.log(`\nJSON catalog written to: ${jsonPath}`);
  
  // Write human-readable report
  const reportPath = resolve(process.cwd(), 'error-report.txt');
  const report = generateReport(catalog);
  writeFileSync(reportPath, report);
  console.log(`Report written to: ${reportPath}`);
  
  // Print summary to console
  console.log('\n' + '='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log(`Total Errors: ${catalog.totalErrors}`);
  console.log('\nBy Category:');
  for (const [category, errors] of Object.entries(errorsByCategory)) {
    if (errors.length > 0) {
      console.log(`  ${category}: ${errors.length}`);
    }
  }
  console.log('\nTop 5 Files by Error Count:');
  const topFiles = Object.entries(errorsByFile)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);
  for (const [file, errors] of topFiles) {
    console.log(`  ${file}: ${errors.length}`);
  }
}

main();
