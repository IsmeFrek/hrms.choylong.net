import puppeteer from 'puppeteer';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return browserPromise;
}

export async function htmlToPdfBuffer(html, opts = {}) {
  const {
    format = 'A4',
    printBackground = true,
    margin = { top: '10mm', right: '15mm', bottom: '10mm', left: '15mm' },
    waitUntil = ['load', 'networkidle0'],
  } = opts || {};

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(String(html || ''), { waitUntil });
    const pdf = await page.pdf({
      format,
      printBackground,
      margin,
    });
    return Buffer.from(pdf);
  } finally {
    try { await page.close(); } catch (e) {}
  }
}
