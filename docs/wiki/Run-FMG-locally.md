To run the Generator locally you need to download its files and start a local web-server.

## Download
Open [Releases](https://github.com/Azgaar/Fantasy-Map-Generator/releases) page, select the latest available version and click on _Source code (zip)_. Unzip _all files_ from the downloaded archive.

## Live Server
If you are a developer you probably don't want to restart the server manually each time you make a change to the code. So you need a web-server with live reload feature. If you are VS Code user, I recommend to install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension. It runs a local server in one click and automatically restarts it on file save.

### Python server
The easiest way to run a local web-server is to use Python's `http.server` module.

1. Install Python. If you are using Linux or macOS, it should be available on your system already. If you are a Windows user, you can get an installer from the [Python homepage](https://www.python.org/downloads). On the first installer page, make sure you check the "Add Python 3.xxx to PATH" checkbox.

2. If you are Windows user, run the `run_python_server.bat` file in the Fantasy Map Generator folder. It will start the web-server and automatically open the Application in Chrome. You can edit the `.bat` file in any text editor if you want to use a different browser or host. 

3. For other systems open the terminal and print a `python -m http.server 8000` command. Then open `http://localhost:8000/` in browser.

### PHP server

1. Install PHP (version 5.4 and higher) from package repository or build from sources. If you are a Windows user, you can get an zip from the [PHP website](https://windows.php.net/download/). Don't forget add path to `php` executable to `PATH` variable.

2. If you are Windows user, run the `run_php_server.bat` file in the Fantasy Map Generator folder. It will start the web-server and automatically open the Application in Chrome. You can edit the `.bat` file in any text editor if you want to use a different browser, host, port or set path to PHP (by default is globally defined in Windows `PATH` variable). 

3. For other systems open the terminal and print a `php -S localhost:3000` command. Then open `http://localhost:3000/` in browser.
