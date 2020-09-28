import { app as electron, BrowserWindow as Window } from "electron";

electron.on('ready', () => {
    const main = new Window();
    main.loadURL(`file://${__dirname}/index.html`);
    main.setMenuBarVisibility(false);
})

electron.on('window-all-closed', () => {
    electron.quit();
})