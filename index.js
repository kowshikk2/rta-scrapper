const puppeteerExtra = require('puppeteer-extra');
const puppeteer = require('puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');

const userAgent = new UserAgent();
//const {executablePath} = require('puppeteer')
puppeteerExtra.use(StealthPlugin());

async function scrapeTrafficDetails(trafficFileNumber) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  //await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
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
          //fineInfo.blackPoints = children[4]?.innerText.replace('Black points', '').trim() || '';

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

    console.log('Traffic Details:', trafficDetails);
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await browser.close();
  }
}

const trafficFileNumber = '50087683';
scrapeTrafficDetails(trafficFileNumber);
