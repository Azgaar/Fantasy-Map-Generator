## What is Ollama?

Ollama is a free program that lets you run AI models directly on your computer. This means:
- **No internet required** - Works offline
- **No monthly fees** - Completely free to use
- **Private** - Your data stays on your computer
- **Fast** - No waiting for online services

Think of it like having your own personal AI generator living on your computer!

## Step 1: Download and Install Ollama

1. Go to [ollama.com](https://ollama.com/)
2. Click the download button and select your system (Windows, Mac, or Linux)
3. Run the downloaded file and follow the installation steps
4. That's it! Ollama is now installed.

## Step 2: Download an AI Model

After installing Ollama, you need to download an AI model (think of it as the "brain" for your AI):

1. **Open Command Prompt** (Windows) or **Terminal** (Mac/Linux):
   - **Windows**: Press `Windows key + R`, type `cmd`, press Enter
   - **Mac**: Press `Cmd + Space`, type `Terminal`, press Enter
   - **Linux**: Press `Ctrl + Alt + T`

2. **Type the command and press Enter:**
   ```
   ollama run llama3.2
   ```

3. **Wait for the download** - This might take 5-30 minutes depending on your internet speed

4. **You'll see a prompt like `>>>` when it's ready** - just type `exit` to close it

5. Visit [ollama.com/search](https://ollama.com/search) to see what other models you can download.

## Step 3: Allow Ollama to be accessed from the web
If you are running FMG locally, you don't need this step. But if you want Ollama to be available form the web-version of the FMG, you need to set OLLAMA_ORIGINS.

### For Windows Users:
1. **Press `Windows key + R`**
2. **Type `sysdm.cpl` and press Enter**
3. **Click the "Environment Variables..." button**
4. **Click "New..." and enter:**
   - Variable name: `OLLAMA_ORIGINS`
   - Variable value: the FMG origins you use, for example `https://azgaar.github.io,http://localhost:5173`
5. **Click "OK" on everything**
6. **Restart the Ollama server if it is running. You may need to restart your computer as well**

### For Mac Users:
1. **Open Terminal**
2. **Type this command:** `nano ~/.zshrc`
3. **Add this line at the end:**
   ```
   export OLLAMA_ORIGINS="https://azgaar.github.io,http://localhost:5173"
   ```
4. **Save and exit:**
   - Press `Ctrl + X`
   - Press `Y` to confirm
   - Press `Enter` to save
5. **Apply the changes:**
   ```
   source ~/.zshrc
   ```
6. **Restart your computer**

### For Linux Users:

1. **Open Terminal**
2. **Type these commands one by one:**
   ```
   echo 'export OLLAMA_HOST="0.0.0.0"' >> ~/.bashrc
   echo 'export OLLAMA_ORIGINS="https://azgaar.github.io,http://localhost:5173"' >> ~/.bashrc
   source ~/.bashrc
   ```
3. **Restart your computer**

## Step 4: Start the server

1. Open Command Prompt/Terminal and type `ollama serve`. **Leave this window open** — Ollama is now running.
2. Open Fantasy Map Generator and open the Assistant: the robot button in the Notes editor, or _Tools → Assistant_. Switch to the **This map** tab.
3. Open the settings with the cog at the bottom right of the panel and choose **Local** as the provider.
4. Leave the model as **custom model…** and type the model name in the field beside the server address: `llama3.2`, or whatever `ollama list` reports. Installed models that Ollama reports are also offered in the model list directly.
5. Leave the API key empty — a local server needs none — and send your message.

**Important:** the Assistant talks to Ollama through its OpenAI-compatible endpoint at `http://localhost:11434/v1`. That is the default in the server field, so it should work as it stands. If Ollama runs on another machine or port, put its address there, and allow the Generator's origin on the Ollama side with `OLLAMA_ORIGINS`.

That's It! You can now generate text using your local AI model.

## Troubleshooting

**If it doesn't work:**
- Check that `ollama serve` is still running in your command prompt/terminal
- Try typing `ollama list` to see if your model downloaded correctly
- Make sure the model name you typed matches exactly what `ollama list` reports
- Smaller local models often cannot write the scripts the assistant uses to read your map. If answers come back empty or malformed, try a larger model
- If you use the hosted version of FMG, double-check `OLLAMA_ORIGINS` includes `https://azgaar.github.io`

## Other providers

The same dialog also supports OpenAI and Anthropic models. For those, the key field is a real API key, which is stored only in your browser's local storage and sent directly to the provider.
