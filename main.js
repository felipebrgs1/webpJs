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

// Função recursiva para listar todos os arquivos em subpastas
async function listFilesRecursively(dir) {
    let results = [];
    const list = await fs.readdir(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(await listFilesRecursively(filePath));
        } else {
            results.push(filePath);
        }
    }
    return results;
}

ipcMain.on("select-folder", async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
    });

    if (!result.canceled) {
        event.reply("folder-selected", result.filePaths[0]);
    }
});

ipcMain.on("convert-images", async (event, { folderPath, deleteOriginal }) => {
    try {
        const files = await listFilesRecursively(folderPath);
        const imageFiles = files.filter(file => /\.(png|jpe?g)$/i.test(file));

        for (const file of imageFiles) {
            const inputPath = file;
            const outputPath = file.replace(/\.(png|jpe?g)$/i, ".webp");
            
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
                file: path.basename(inputPath),
                webpFile: path.basename(outputPath),
                originalSize: originalSizeFormatted,
                webpSize: webpSizeFormatted,
                reduction: reductionPercent
            });

            // Deletar arquivo original se a opção estiver marcada
            if (deleteOriginal) {
                await fs.unlink(inputPath);
            }
        }

        event.reply("conversion-complete", "Conversão concluída!");
    } catch (error) {
        event.reply("conversion-error", `Erro: ${error.message}`);
    }
});
