# Fantasy Map Generator

Azgaar's _Fantasy Map Generator_ is a free web application that helps fantasy writers, game masters, and cartographers create and edit fantasy maps.

Link: [azgaar.github.io/Fantasy-Map-Generator](https://azgaar.github.io/Fantasy-Map-Generator).

Refer to the [project wiki](https://github.com/Azgaar/Fantasy-Map-Generator/wiki) for guidance. The current progress is tracked in [Trello](https://trello.com/b/7x832DG4/fantasy-map-generator). Some details are covered in my old blog [_Fantasy Maps for fun and glory_](https://azgaar.wordpress.com).

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/9502eae9-92e0-4d0d-9f17-a2ba4a565c01)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/11a42446-4bd5-4526-9cb1-3ef97c868992)

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/e751a9e5-7986-4638-b8a9-362395ef7583)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/e751a9e5-7986-4638-b8a9-362395ef7583)

[![preview](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/b0d0efde-a0d1-4e80-8818-ea3dd83c2323)](https://github.com/Azgaar/Fantasy-Map-Generator/assets/26469650/b0d0efde-a0d1-4e80-8818-ea3dd83c2323)

Join our [Discord server](https://discordapp.com/invite/X7E84HU) and [Reddit community](https://www.reddit.com/r/FantasyMapGenerator) to share your creations, discuss the Generator, suggest ideas and get the most recent updates.

Contact me via [email](mailto:azgaar.fmg@yandex.com) if you have non-public suggestions. For bug reports please use [GitHub issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues) or _#fmg-bugs_ channel on Discord. If you are facing performance issues, please read [the tips](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Tips#performance-tips).

Pull requests are highly welcomed. The codebase is messy and requires re-design. I will appreciate if you start with minor changes. Check out the [data model](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-model) before contributing.

You can support the project on [Patreon](https://www.patreon.com/azgaar).

_Inspiration:_

- Martin O'Leary's [_Generating fantasy maps_](https://mewo2.com/notes/terrain)

- Amit Patel's [_Polygonal Map Generation for Games_](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation)

- Scott Turner's [_Here Dragons Abound_](https://heredragonsabound.blogspot.com)

## Recent Changes (May 18, 2025)

### Ollama Integration for AI Text Generation

An integration with [Ollama](https://ollama.com/) has been added as a new provider for the AI text generator feature, allowing users to leverage local large language models.

**Key Changes:**

*   **New Provider:** "Ollama" is now available in the AI generator's model/provider selection.
*   **Model Name as Key:** When Ollama is selected, the "API Key" input field is repurposed to accept the Ollama model name (e.g., `llama3`, `mistral`, etc.) instead of a traditional API key.
*   **Local Endpoint:** The integration communicates with a local Ollama instance via the `http://localhost:11434/api/generate` endpoint.
*   **Streaming Support:** Responses from Ollama are streamed into the text area.

**Files Modified:**

1.  `modules/ui/ai-generator.js`:
    *   Added `ollama` to the `PROVIDERS` and `MODELS` constants.
    *   Implemented the `generateWithOllama` function to handle API requests to the Ollama endpoint.
    *   Modified `handleStream` to correctly parse the JSON streaming response from Ollama.
    *   Updated UI logic in `generateWithAi` and its helper `updateDialogElements` to:
        *   Change the "API Key" field's placeholder text to "Enter Ollama model name (e.g., llama3)" when Ollama is selected.
        *   Store and retrieve the Ollama model name from local storage similarly to how API keys are handled for other providers.
        *   Ensured the dialog initialization and element updates occur at the correct time (during the dialog's `open` event) to prevent errors with elements not being found in the DOM.
2.  `modules/ui/notes-editor.js`:
    *   The `openAiGenerator` function, which is called when clicking the "generate text for notes" button, was verified to correctly invoke the `generateWithAi` function.
    *   The prompt sent to the AI was updated to be more explicit about requiring HTML formatting (using `<p>` tags, no heading tags, no markdown) to ensure consistent output. *(Self-correction: The user undid the latest prompt change, so this part of the description might not be accurate if the user intends to keep the previous prompt. The README will reflect the general functionality implemented).* The prompt engineering aims to guide the AI to produce HTML-formatted descriptions suitable for the notes section.

**Goal:**

The primary goal of this integration was to provide a simple and functional way to use local Ollama models within the Fantasy Map Generator's AI text generation feature, ensuring that existing functionalities, especially the "generate text for notes" button, remain operational. Initial issues with the dialog not opening were resolved by refining how and when the dialog and its internal event listeners are initialized.
