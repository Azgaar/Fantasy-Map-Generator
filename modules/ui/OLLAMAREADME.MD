
## Recent Changes (May 18, 2025)

### Ollama Integration for AI Text Generation

An integration with [Ollama](https://ollama.com/) has been added as a new provider for the AI text generator feature, allowing users to leverage local large language models.

**Key Changes:**

* **New Provider:** "Ollama" is now available in the AI generator's model/provider selection.
* **Model Name as Key:** When Ollama is selected, the "API Key" input field is repurposed to accept the Ollama model name (e.g., `llama3`, `mistral`, etc.) instead of a traditional API key.
* **Local Endpoint:** The integration communicates with a local Ollama instance. Configuration details below.
* **Streaming Support:** Responses from Ollama are streamed into the text area.

## Ollama Setup and Configuration

To use Ollama with Fantasy Map Generator, you need to ensure Ollama is correctly running and configured on your machine.

**1. Install Ollama:**

* Download and install Ollama from [ollama.com](https://ollama.com/).
* Download the desired models (e.g., `ollama run llama3`).

**2. Configure Ollama for Network Access (Crucial Step):**

By default, Ollama might only listen for connections from the same machine (`localhost` or `127.0.0.1`). For Fantasy Map Generator to access Ollama, especially from other devices on your local network, you must configure Ollama to listen on all network interfaces and allow cross-origin requests.

* **Set `OLLAMA_HOST` Environment Variable:**
    * This variable tells Ollama which network interfaces to listen on.
    * **Action:** Set `OLLAMA_HOST` to `0.0.0.0`.
    * **How to set (Windows Permanent):**
        1.  Search for "Edit the system environment variables" in the Windows search bar.
        2.  Click "Environment Variables...".
        3.  In the "System variables" section (bottom pane), click "New..." (or "Edit..." if it exists).
        4.  Variable name: `OLLAMA_HOST`
        5.  Variable value: `0.0.0.0`
        6.  Click "OK" on all dialogs.
        7.  **Restart your PC** for the changes to take effect for all processes.
    * **How to set (Linux/macOS - per session or persistent):**
        1.  **Per session:** In your terminal, before running `ollama serve`: `export OLLAMA_HOST="0.0.0.0"`
        2.  **Persistent:** Add `export OLLAMA_HOST="0.0.0.0"` to your shell profile file (e.g., `~/.bashrc`, `~/.zshrc`), then `source` the file or restart your terminal.

* **Set `OLLAMA_ORIGINS` Environment Variable (CORS Configuration):**
    * This variable is essential for browsers to allow JavaScript code from one origin (Fantasy Map Generator's port 8000) to communicate with Ollama on a different port (11434).
    * **Action:** Set `OLLAMA_ORIGINS` to allow your Fantasy Map Generator's origin.
    * **How to set (Windows Permanent):** Follow the same steps as for `OLLAMA_HOST`, but use:
        * Variable name: `OLLAMA_ORIGINS`
        * Variable value: `http://<YOUR_PC_IP_ADDRESS>:8000` (e.g., `http://192.168.178.46:8000`)
        * **For development (easiest):** You can use `*` as the value (`OLLAMA_ORIGINS=*`) to allow all origins. This is less secure for production but simplifies testing.
        * **Restart your PC** after setting the variable.
    * **How to set (Linux/macOS - per session or persistent):**
        1.  **Per session:** `export OLLAMA_ORIGINS="http://<YOUR_PC_IP_ADDRESS>:8000"` or `export OLLAMA_ORIGINS="*"`
        2.  **Persistent:** Add the `export` line to your shell profile file.

* **Firewall Configuration:**
    * Ensure your PC's firewall (e.g., Windows Defender Firewall) is not blocking incoming connections to Ollama's default port, `11434`.
    * **Action:** Create an inbound rule to allow TCP traffic on port `11434`.

**3. Configure Fantasy Map Generator's `ai-generator.js`:**

The `ai-generator.js` file needs to point to the correct Ollama endpoint.

* **Scenario A: Using only on the same machine (`localhost`):**
    * Ensure the `fetch` call in the `generateWithOllama` function (inside `modules/ui/ai-generator.js`) points to `http://localhost:11434/api/generate`. This is usually the default.

* **Scenario B: Using from other machines on the local network:**
    * You **must** change the `fetch` call in the `generateWithOllama` function (inside `modules/ui/ai-generator.js`) to use the actual local IP address of your machine where Ollama is running.
    * **Example:**
        ```javascript
        // Inside modules/ui/ai-generator.js, within generateWithOllama function:
        const response = await fetch("http://192.168.178.46:11434/api/generate" // Replace with your actual PC's IP

        ```
    * **How to find your PC's IP:**
        * **Windows:** Open Command Prompt (`cmd`) and type `ipconfig`. Look for "IPv4 Address" under your active network adapter.
        * **Linux/macOS:** Open Terminal and type `ip addr show` or `ifconfig`.

---
