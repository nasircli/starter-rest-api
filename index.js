const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const readline = require('readline');

const app = express();
const port = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTagsFromUrl(url, tagSelector) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);
    const tags = $(tagSelector).map((_, element) => $(element).text().trim()).get();

    return tags;
  } catch (error) {
    if (error.response) {
      const { status } = error.response;
      if (status === 403) {
        console.error(`Error 403: Access forbidden for URL: ${url}`);
      } else if (status === 404) {
        console.error(`Error 404: URL not found: ${url}`);
      } else {
        console.error(`HTTP Error: ${status} - ${error.message}`);
      }
    } else {
      console.error(`Error: ${error.message}`);
    }
    return null;
  }
}

async function getCrawledData(mainInput, tagSelector, res) {
  try {
    const parsedUrl = new URL(mainInput);
    const mainUrl = parsedUrl.href;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    const response = await axios.get(mainUrl, { headers });
    const $ = cheerio.load(response.data);
    const mainTags = await getTagsFromUrl(mainUrl, tagSelector);

    const uniqueTags = new Set(mainTags);

    if (mainTags) {
      res.write(`Best 3 Tags from Each Images (1st Page) - ${mainUrl}:\n`);
      res.write(`${mainTags.join(', ')}\n`);
      res.write('-'.repeat(50) + '\n');
    }

    const links = [];
    $('body.new-resource-list .filter-tags-row .tag-slider--list li a, body.new-resource-list .no-results--popular .tag-slider--list li a').each((_, element) => {
      links.push(new URL($(element).attr('href'), mainUrl).href);
    });

    for (const link of links) {
      const tags = await getTagsFromUrl(link, tagSelector);
      if (tags) {
        tags.forEach(tag => uniqueTags.add(tag));
        await sleep(1000); // Add a 1-second delay between requests to avoid being blocked
      }
    }

    res.write('Tags from All Slider Tags:\n');
    res.write(`${[...uniqueTags].join(', ')}\n`);
    res.write('-'.repeat(50) + '\n');

    displayAllTags([...uniqueTags], res);

  } catch (error) {
    if (error.response) {
      const { status } = error.response;
      if (status === 403) {
        res.write(`Error 403: Access forbidden for URL: ${mainUrl}\n`);
      } else if (status === 404) {
        res.write(`Error 404: URL not found: ${mainUrl}\n`);
      } else {
        res.write(`HTTP Error: ${status} - ${error.message}\n`);
      }
    } else {
      res.write(`Error: ${error.message}\n`);
    }
    res.end();
  }
}

function displayAllTags(uniqueTags, res) {
  const allUniqueTags = [...new Set(uniqueTags)];
  res.write('All Unique Tags (after removing duplicates):\n');
  res.write(`${allUniqueTags.join(', ')}\n`);
  res.write('-'.repeat(50) + '\n');
  res.end();
}

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  const rl = readline.createInterface({
    input: process.stdin,
    output: res
  });

  // Prompt the user for a main link or keyword to crawl
  rl.question('Enter the main link or keyword to crawl: ', (mainInput) => {
    getCrawledData(mainInput, '.showcase .showcase__item.showcase__item--buttons .showcase__thumbnail .tags-container ul.tags>li>.tag-item', res);
    rl.close();
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
