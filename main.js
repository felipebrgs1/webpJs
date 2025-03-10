const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile("index.html");
});

ipcMain.on("select-folder", async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
    });

    if (!result.canceled) {
        event.reply("folder-selected", result.filePaths[0]);
    }
});

ipcMain.on("convert-images", async (event, folderPath) => {
    try {
        const files = await fs.readdir(folderPath);
        const imageFiles = files.filter(file => /\.(png|jpe?g)$/i.test(file));

        for (const file of imageFiles) {
            const inputPath = path.join(folderPath, file);
            const outputPath = path.join(folderPath, file.replace(/\.(png|jpe?g)$/i, ".webp"));
            
            // Obter tamanho do arquivo original
            const originalSize = (await fs.stat(inputPath)).size;

            await sharp(inputPath)
                .toFormat("webp")
                .toFile(outputPath);

            // Obter tamanho do arquivo convertido
            const webpSize = (await fs.stat(outputPath)).size;
            
            // Calcular redução
            const reduction = originalSize - webpSize;
            const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);
            
            // Formatar tamanhos para exibição
            const originalSizeFormatted = (originalSize / 1024).toFixed(2);
            const webpSizeFormatted = (webpSize / 1024).toFixed(2);

            event.reply("conversion-status", {
                file: file,
                webpFile: path.basename(outputPath),
                originalSize: originalSizeFormatted,
                webpSize: webpSizeFormatted,
                reduction: reductionPercent
            });
        }

        event.reply("conversion-complete", "Conversão concluída!");
    } catch (error) {
        event.reply("conversion-error", `Erro: ${error.message}`);
    }
});
