const puppeteer = require('puppeteer');
let browser;
let pageCount = 0;
const MAX_PAGES_BEFORE_ROTATION = 50;

async function getBrowser() {
  if (!browser) {
    console.log('Iniciando instância fresh do navegador...');
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
      timeout: 30000
    });
  }

  pageCount++;
  console.log('Contador de páginas criado:', pageCount);

  if (pageCount >= MAX_PAGES_BEFORE_ROTATION) {
    console.log(`Rotacionando o navegador após ${pageCount} páginas...`);
    await browser.close();
    browser = null;
    pageCount = 0;
    console.log('Iniciando nova instância do navegador após rotação...');
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
      timeout: 30000
    });
  }

  return browser;
}

const express = require('express');
const async = require('async'); // Importa o pacote async
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,            // até 20 requisições/min por IP
  message: 'Muitas requisições, tente novamente mais tarde.'
});

const app = express();
app.set('trust proxy', 1);
app.use(limiter);

// Cria uma fila com um número máximo de 2 tarefas executadas de cada vez
const queue = async.queue(async (task, done) => {
    console.log('Processando solicitação:', task.url);  // Log para saber qual solicitação está sendo processada

    const { url, res } = task;
    let page;

    try {
        const br = await getBrowser();
        page = await br.newPage();
        await page.setViewport({ width: 1080, height: 1080 });

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

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
        const screenshot = await element.screenshot({
          type: 'jpeg',
          encoding: 'base64',
          quality: 90
        });

        res.json({ image: `data:image/jpeg;base64,${screenshot}` });
    } catch (error) {
        console.error('Erro durante a renderização:', error);
        res.status(500).json({ error: 'Erro ao renderizar o elemento.' });
    } finally {
        if (page) {
            await page.close();
        }
    }

    console.log('Finalizou processamento da URL:', url);
    done();  // Chama o done para indicar que a tarefa foi concluída
}, 2);  // Limitando a fila para processar 2 tarefas por vez

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
