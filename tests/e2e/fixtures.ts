/**
 * Shared Playwright `test` / `expect` instance for e2e specs.
 */
import { expect, test as base } from "@playwright/test";

export const test = base;

export { expect };
