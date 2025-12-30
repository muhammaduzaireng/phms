import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

// Clean price string like "3,104.59" → 3104.59
const cleanPrice = (text) => {
  return parseFloat(text.replace(/,/g, "").trim()) || 0;
};

// Clean date (already in DD MMM, YYYY format)
const cleanDate = (text) => text.trim();

async function scrapePage(page = 1) {
  const url = `https://e.dra.gov.pk/public/price?page=${page}`;
  console.log(`Fetching page ${page}...`);

  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const drugs = [];

  $("tbody tr").each((i, row) => {
    const cols = $(row).find("td");

    // Product Name & Generic Name
    const productName = $(cols[0]).find(".text-sm.font-medium").text().trim();
    const genericName = $(cols[0]).find(".text-sm.text-gray-500").text().trim();

    // Registration Number
    const regNumber = $(cols[1]).text().trim();

    // Manufacturer & DSL/DML
    const manufacturer = $(cols[2]).find("div.text-sm.text-gray-900").text().trim();
    const dslDml = $(cols[2]).find("div.text-sm.text-gray-500").text().trim();

    // Category
    const category = $(cols[3]).text().trim();

    // Pack Size
    const packSize = $(cols[4]).text().trim();

    // Price
    const priceText = $(cols[5]).find("span").last().text().trim();
    const price = cleanPrice(priceText);

    // Effective From
    const effectiveFrom = cleanDate($(cols[6]).text());

    drugs.push({
      product_name: productName,
      generic_name: genericName,
      reg_number: regNumber,
      manufacturer: manufacturer,
      dsl_dml: dslDml,
      category: category,
      pack_size: packSize,
      price_rs: price,
      effective_from: effectiveFrom,
    });
  });

  return drugs;
}

async function main() {
  let allData = [];
  for (let page = 1; page <= 897; page++) {
    const data = await scrapePage(page);
    allData = allData.concat(data);
    console.log(`Page ${page} done (${data.length} items)`);
    // Be nice to the server
    await new Promise((r) => setTimeout(r, 500));
  }
  fs.writeFileSync("drap_all.json", JSON.stringify(allData, null, 2));
  console.log("\nSaved: drap_page1.json");

  // Save as CSV
  const csvHeader =
    "Product Name,Generic Name,Reg Number,Manufacturer,DSL/DML,Category,Pack Size,Price (Rs),Effective From\n";
  const csvRows = data
    .map((d) =>
      [
        `"${d.product_name}"`,
        `"${d.generic_name}"`,
        d.reg_number,
        `"${d.manufacturer}"`,
        `"${d.dsl_dml}"`,
        d.category,
        `"${d.pack_size}"`,
        d.price_rs,
        d.effective_from,
      ].join(",")
    )
    .join("\n");
  fs.writeFileSync("drap_page1.csv", csvHeader + csvRows);
  console.log("Saved: drap_page1.csv");

  console.log("\nDone! Open the CSV in Excel or Google Sheets.");
}

main().catch((err) => console.error("Error:", err));