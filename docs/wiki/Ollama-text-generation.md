## What is Ollama?

Ollama is a free program that lets you run AI models directly on your computer. This means:
- **No internet required** - Works offline
- **No monthly fees** - Completely free to use
- **Private** - Your data stays on your computer
- **Fast** - No waiting for online services

Think of it like having your own personal AI generator living on your computer!

## Step 1: Download and Install Ollama

1. Go to [[ollama.com](https://ollama.com/)](https://ollama.com/)
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
3. **Click "Environment Variables..." button**
7. **Click "New..." and enter:**
   - Variable name: `OLLAMA_ORIGINS`
   - Variable value: `https://azgaar.github.io,https://*afmg.netlify.app,http://127.0.0.1:5501`
8. **Click "OK" on everything**
9. **Restart ollama sever if it's running. You may need to restart you computer as well**

### For Mac Users:
1. **Open Terminal**
2. **Type this command:** `nano ~/.zshrc`
3. **Add these two lines at the end:**
   ```
   export OLLAMA_ORIGINS="https://azgaar.github.io,https://*afmg.netlify.app,http://127.0.0.1:5501"
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
   echo 'export OLLAMA_ORIGINS="https://azgaar.github.io,https://*afmg.netlify.app,http://127.0.0.1:5501"' >> ~/.bashrc
   source ~/.bashrc
   ```
3. **Restart your computer**

## Step 4: Start the server

1. Open Command Prompt/Terminal. Type: `ollama serve`. Leave this window open** - Ollama is now running!
2. Open Fantasy Map Generator. Open AI notes generator and select "ollama" from the AI model list
3. In the key field, type: `llama3.2` (or whatever model you downloaded)
4. Update the prompt and click on `generate`

**Important:** Fantasy Map Generator connects to Ollama at `http://localhost:11434/api/generate`. This should work automatically by default. If you need to change the connection address, you can modify the endpoint in the FMG `ai-generator.js` file.

That's It! You can now generate text using your local AI model.

## Troubleshooting

**If it doesn't work:**
- Check that `ollama serve` is still running in your command prompt/terminal
- Try typing `ollama list` to see if your model downloaded correctly