/**
 * UI Integration tests for zones GeoJSON export button
 * Feature: zones-geojson-export
 * 
 * These tests verify the zones export button is correctly integrated into the UI
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("zones GeoJSON export - UI Integration Tests", () => {
  let htmlContent: string;

  beforeAll(() => {
    // Read the index.html file
    const htmlPath = join(__dirname, "../../index.html");
    htmlContent = readFileSync(htmlPath, "utf-8");
  });

  /**
   * Test 4.2.1: Button exists in correct location
   * Validates: Requirement 4.1, 4.4
   * The zones button should be in the "Export to GeoJSON" section after the markers button
   */
  it("should have zones button in correct location after markers button", () => {
    // Find the GeoJSON export section
    expect(htmlContent).toContain("Export to GeoJSON");

    // Find the markers button
    const markersButtonPattern = /<button[^>]*onclick="saveGeoJsonMarkers\(\)"[^>]*>markers<\/button>/;
    const markersMatch = htmlContent.match(markersButtonPattern);
    expect(markersMatch).toBeTruthy();

    // Find the zones button
    const zonesButtonPattern = /<button[^>]*onclick="saveGeoJsonZones\(\)"[^>]*>zones<\/button>/;
    const zonesMatch = htmlContent.match(zonesButtonPattern);
    expect(zonesMatch).toBeTruthy();

    // Verify zones button comes after markers button in the HTML
    const markersIndex = htmlContent.indexOf(markersMatch![0]);
    const zonesIndex = htmlContent.indexOf(zonesMatch![0]);
    expect(zonesIndex).toBeGreaterThan(markersIndex);
  });

  /**
   * Test 4.2.2: Button has correct tooltip
   * Validates: Requirement 4.2
   * The zones button should have a data-tip attribute with the correct tooltip text
   */
  it("should have correct tooltip on zones button", () => {
    // Find the zones button with data-tip attribute
    const zonesButtonPattern = /<button[^>]*onclick="saveGeoJsonZones\(\)"[^>]*data-tip="([^"]*)"[^>]*>zones<\/button>/;
    const match = htmlContent.match(zonesButtonPattern);
    
    expect(match).toBeTruthy();
    expect(match![1]).toBe("Download zones data in GeoJSON format");
  });

  /**
   * Test 4.2.3: Button has correct onclick handler
   * Validates: Requirement 4.3
   * The zones button should have onclick="saveGeoJsonZones()"
   */
  it("should have correct onclick handler", () => {
    // Find the zones button with onclick attribute
    const zonesButtonPattern = /<button[^>]*onclick="(saveGeoJsonZones\(\))"[^>]*>zones<\/button>/;
    const match = htmlContent.match(zonesButtonPattern);
    
    expect(match).toBeTruthy();
    expect(match![1]).toBe("saveGeoJsonZones()");
  });

  /**
   * Test 4.2.4: Button is in the GeoJSON export section
   * Validates: Requirement 4.1
   * The zones button should be in the same div as other GeoJSON export buttons
   */
  it("should be in the GeoJSON export section with other export buttons", () => {
    // Find the GeoJSON export section
    const geojsonSectionPattern = /<div[^>]*>Export to GeoJSON<\/div>\s*<div>([\s\S]*?)<\/div>/;
    const match = htmlContent.match(geojsonSectionPattern);
    
    expect(match).toBeTruthy();
    
    const exportButtonsSection = match![1];
    
    // Verify all expected buttons are in the section
    expect(exportButtonsSection).toContain('onclick="saveGeoJsonCells()"');
    expect(exportButtonsSection).toContain('onclick="saveGeoJsonRoutes()"');
    expect(exportButtonsSection).toContain('onclick="saveGeoJsonRivers()"');
    expect(exportButtonsSection).toContain('onclick="saveGeoJsonMarkers()"');
    expect(exportButtonsSection).toContain('onclick="saveGeoJsonZones()"');
  });
});
