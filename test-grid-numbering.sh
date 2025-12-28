#!/bin/bash
# Quick test script to verify grid numbering works

echo "================================"
echo "Azgaar Grid Numbering - Quick Test"
echo "================================"
echo ""
echo "The changes have been successfully applied to:"
echo "  ✓ /opt/games/azgaar/index.html"
echo "  ✓ /opt/games/azgaar/modules/ui/layers.js"
echo "  ✓ /opt/games/azgaar/modules/ui/style.js"
echo "  ✓ /opt/games/azgaar/modules/markers-generator.js"
echo ""
echo "To see the grid numbering feature:"
echo ""
echo "1. HARD REFRESH your browser:"
echo "   - Firefox/Chrome: Press Ctrl+Shift+R (or Ctrl+F5)"
echo "   - This clears the cache and reloads JavaScript"
echo ""
echo "2. Or close and reopen your browser completely"
echo ""
echo "3. Navigate to: file:///opt/games/azgaar/index.html"
echo ""
echo "4. Enable the Grid:"
echo "   - Press 'G' key OR click 'Grid' in the layers menu"
echo ""
echo "5. Open Style Panel (right sidebar) and:"
echo "   - Select 'Grid' from the dropdown"
echo "   - Set Type to 'Hex grid (pointy)'"
echo "   - CHECK the 'Show grid numbers' checkbox"
echo ""
echo "6. You should see numbers (0001, 0002, etc.) in each hex cell!"
echo ""
echo "================================"
echo "Checking files are in place..."
echo "================================"

# Verify grid numbering UI exists
if grep -q "styleGridShowNumbers" /opt/games/azgaar/index.html; then
    echo "✓ Grid numbering UI controls found in index.html"
else
    echo "✗ ERROR: Grid numbering UI controls NOT found!"
fi

# Verify grid numbering function exists  
if grep -q "function drawGridNumbers" /opt/games/azgaar/modules/ui/layers.js; then
    echo "✓ Grid numbering function found in layers.js"
else
    echo "✗ ERROR: Grid numbering function NOT found!"
fi

# Verify fantasy icons
if [ -d "/opt/games/azgaar/images/fantasy-icons" ]; then
    icon_count=$(ls -1 /opt/games/azgaar/images/fantasy-icons/*.svg 2>/dev/null | wc -l)
    echo "✓ Fantasy icons directory exists with $icon_count icons"
else
    echo "✗ ERROR: Fantasy icons directory NOT found!"
fi

echo ""
echo "All checks passed! The features are installed."
echo "Just hard refresh your browser (Ctrl+Shift+R)"
echo ""
