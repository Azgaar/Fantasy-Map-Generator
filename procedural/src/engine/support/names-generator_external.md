# External Dependencies for names-generator.js

The refactored `names-generator.js` module requires the following external dependencies to be imported:

## Utility Functions
- `ERROR` - Error logging flag/function
- `WARN` - Warning logging flag/function  
- `P` - Probability function (returns true/false based on probability)
- `ra` - Random array element selector function
- `last` - Function to get last character/element of a string/array
- `vowel` - Function to check if a character is a vowel
- `capitalize` - Function to capitalize a string
- `rand` - Random number generator function

These utilities should be imported from a common utilities module (e.g., `../utils/index.js`) and passed as a `utils` object parameter to the exported functions.

## Data Dependencies
- `nameBases` - Array of name base configurations (passed as parameter)
- `cultures` - Culture data object with base references (passed as parameter from pack data)

## Notes
- All global state access has been removed and replaced with parameter injection
- The module is now pure and environment-agnostic
- No browser or DOM dependencies remain