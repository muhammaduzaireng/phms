import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

const BASE_URL = "https://e.dra.gov.pk/public/price?page=";

async function scrapePage(pageNum) {
    try {
        const url = `${BASE_URL}${pageNum}`;
        console.log(`Scraping page ${pageNum}...`);

        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        let results = [];

        $("tbody tr").each((i, el) => {
            const tds = $(el).find("td");

            const productName = $(tds[0]).find(".text-sm.font-medium").text().trim();
            const productDescription = $(tds[0]).find(".text-sm.text-gray-500").text().trim();

            const code = $(tds[1]).text().trim();

            const company = $(tds[2]).find(".text-sm.text-gray-900").text().trim();
            const dsl = $(tds[2]).find(".text-sm.text-gray-500").text().replace("DSL: ", "").trim();

            const category = $(tds[3]).text().trim();

            const pack = $(tds[4]).text().trim();

            const price = $(tds[5]).find("span span:last-child").text().trim();

            const date = $(tds[6]).text().trim();

            results.push({
                productName,
                productDescription,
                code,
                company,
                dsl,
                category,
                pack,
                price,
                date,
            });
        });

        return results;

    } catch (err) {
        console.error(`Error on page ${pageNum}:`, err.message);
        return [];
    }
}

async function scrapeAllPages() {
    let allData = [];

    for (let i = 1; i <= 892; i++) {
        const rows = await scrapePage(i);
        allData.push(...rows);

        await new Promise(r => setTimeout(r, 300)); // avoid banning
    }

    fs.writeFileSync("prices.json", JSON.stringify(allData, null, 2));
    console.log("Scraping complete! Data saved to prices.json");
}

scrapeAllPages();
