export interface HeightmapTestCase {
    name: string;
    recipe: string;
    isTemplate?: boolean;
}

export const heightmapTestCases: HeightmapTestCase[] = [
    // Custom execution strings
    { name: "hill", recipe: "Hill 1 90-100 44-56 40-60" },
    { name: "add", recipe: "Add 30 0-100" },
    { name: "mult", recipe: "Add 20 all\nHill 1 50 50 50\nMultiply 1.5 land\nMultiply 0.5 0-20" },
    { name: "pit", recipe: "Add 50 0-100\nPit 1 30 50 50" },
    { name: "pit_shallow", recipe: "Add 50 0-100\nPit 1 5 50 50" },
    { name: "smooth", recipe: "Add 20 all\nHill 1 60 50 50\nSmooth 2 0\nSmooth 1.5 1" },
    { name: "invert", recipe: "Add 20 all\nHill 1 60 20 20\nInvert 1 x" },
    { name: "range", recipe: "Add 15 all\nRange 1 60 10-20 10-20\nSmooth 2" },
    { name: "trough", recipe: "Add 70 all\nTrough 1 40 40-60 5-10\nSmooth 1.5" },
    { name: "strait", recipe: "Add 50 all\nStrait 15 vertical\nStrait 15 horizontal" },
    
    // Existing FMG templates (Flag explicitly set to true)
    { name: "template_highIsland", recipe: "highIsland", isTemplate: true },
    { name: "template_archipelago", recipe: "archipelago", isTemplate: true },
    { name: "template_shattered", recipe: "shattered", isTemplate: true },
    { name: "template_volcano", recipe: "volcano", isTemplate: true },
    { name: "template_fractious", recipe: "fractious", isTemplate: true },
    { name: "template_continents", recipe: "continents", isTemplate: true }
];

/**
 * Helper: Injects the test recipe into the global scope.
 * Now takes the whole HeightmapTestCase object!
 */
export const injectRecipeToGlobals = (testCase: HeightmapTestCase) => {
    // Clean, explicit boolean check
    if (testCase.isTemplate) {
        (globalThis as any).__TEST_TEMPLATE_ID__ = testCase.recipe;
        return;
    }

    // Custom multi-step string logic
    const tempId = "custom_regression_recipe";
    (globalThis as any).__TEST_TEMPLATE_ID__ = tempId;
    
    if (!(globalThis as any).heightmapTemplates) {
        (globalThis as any).heightmapTemplates = {};
    }
    
    (globalThis as any).heightmapTemplates[tempId] = { template: testCase.recipe };
};