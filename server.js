const express = require('express');
const puppeteerExtra = require('puppeteer-extra');
const puppeteer = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');

const app = express();
app.use(express.json()); // for parsing application/json

puppeteerExtra.use(StealthPlugin());

const userAgent = new UserAgent();

async function scrapeTrafficDetails(trafficFileNumber) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setUserAgent(userAgent.toString());
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  });

  const url = 'https://ums.rta.ae/violations/public-fines/fines-search';

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log('Page loaded');

    await page.waitForSelector('div.slick-slide[data-index="3"]', { timeout: 30000 });
    console.log('Tab found');
    await page.click('div.slick-slide[data-index="3"]');
    console.log('Tab clicked');

    await page.waitForSelector('#Id_trafficFileNumber', { timeout: 15000 });
    console.log('Input field found');
    
    await page.type('#Id_trafficFileNumber', trafficFileNumber);
    console.log('Traffic file number entered');

    await page.waitForSelector('button#Id_searchBTN', { timeout: 15000 });
    console.log('Search button found');
    await page.click('button#Id_searchBTN');
    console.log('Search button clicked');

    await page.waitForFunction(() => {
      const table = document.querySelector('.p-datatable-table');
      const rows = table ? table.querySelectorAll('tbody tr').length : 0;
      return table && rows > 0;
    }, { timeout: 30000 });
    console.log('Results loaded');

    const trafficDetails = await page.evaluate(() => {
      const rows = document.querySelectorAll('.p-datatable-tbody tr');
      let details = [];
    
      rows.forEach(async (row) => {
        const cell = row.querySelector('td div.finesRowList');
        if (cell) {
          const fineInfo = {};
          const children = cell.querySelectorAll('div');
          
          fineInfo.vehicleDetails = children[0]?.innerText.trim() || '';
          fineInfo.issueDate = children[1]?.innerText.replace('Date and time of issuing the fine', '').trim() || '';
          fineInfo.amount = children[2]?.innerText.replace('Amount', '').trim() || '';
          fineInfo.source = children[3]?.innerText.replace('Source', '').trim() || '';

          row.click();

          const licensePlateElement = document.querySelector('.plateboxView .GC_plate');
          if (licensePlateElement) {
            const plateLetter = licensePlateElement.querySelector('span')?.innerText || '';
            const plateNumber = licensePlateElement.querySelector('div')?.innerText || '';
            fineInfo.licensePlate = `${plateLetter} ${plateNumber}`.trim();
          } else {
            fineInfo.licensePlate = 'N/A';
          }

          const detailContainer = document.querySelector('.dataList');
          if (detailContainer) {
            fineInfo.location = detailContainer.querySelector('div:nth-child(2) p')?.innerText || '-';
            fineInfo.fineNumber = detailContainer.querySelector('div:nth-child(7) p')?.innerText || 'N/A';
            fineInfo.details = detailContainer.querySelector('ul li')?.innerText || 'N/A';
          }
          
          details.push(fineInfo);
        }
      });
    
      return details;
    });

    await browser.close();
    return trafficDetails;
  } catch (error) {
    await browser.close();
    console.error('An error occurred:', error);
    throw error;
  }
}

// POST endpoint to handle the scraping
app.post('/scrape-traffic', async (req, res) => {
  const { trafficFileNumber } = req.body;

  if (!trafficFileNumber) {
    return res.status(400).json({ error: 'trafficFileNumber is required' });
  }

  try {
    const details = await scrapeTrafficDetails(trafficFileNumber);
    res.json(details); // Send scraped details as a JSON response
  } catch (error) {
    res.status(500).json({ error: 'Failed to scrape traffic details' });
  }
});

// Start the Express server
const PORT = 3005;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
