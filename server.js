const puppeteer = require('puppeteer');
const express = require('express');
const async = require('async'); // Importa o pacote async
const app = express();

// Cria uma fila com um número máximo de 1 tarefa executada de cada vez
const queue = async.queue(async (task, done) => {
    console.log('Processando solicitação:', task.url);  // Log para saber qual solicitação está sendo processada

    const { url, res } = task;

    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true,
            timeout: 90000
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1500, height: 1500 });

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });

        const elementSelector = '#templete';
        await page.waitForSelector(elementSelector);

        await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.width = '1500px';
                element.style.height = '1500px';
            }
        }, elementSelector);

        const element = await page.$(elementSelector);
        const screenshot = await element.screenshot({ type: 'png', encoding: 'base64' });

        await browser.close();

        res.json({ image: `data:image/png;base64,${screenshot}` });
    } catch (error) {
        console.error('Erro durante a renderização:', error);
        res.status(500).json({ error: 'Erro ao renderizar o elemento.' });
    }

    done();  // Chama o done para indicar que a tarefa foi concluída
}, 1);  // Limitando a fila para processar 1 tarefa por vez

// Permite receber JSON no body da requisição
app.use(express.json());

// Endpoint para renderizar e capturar o elemento específico
app.post('/render', (req, res) => {
    const { url } = req.body;

    console.log('Solicitação recebida para renderizar a URL:', url);

    if (!url) {
        console.log('Erro: URL não fornecida');
        return res.status(400).json({ error: 'URL é necessária!' });
    }

    // Adiciona a tarefa na fila
    queue.push({ url, res });

    // Log para saber que a solicitação foi enfileirada
    console.log('Solicitação enfileirada para processamento:', url);
});

// Configura a porta do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
