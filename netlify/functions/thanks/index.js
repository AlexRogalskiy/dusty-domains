const fetch = require('node-fetch');
const { EleventyServerless } = require('@11ty/eleventy');

// Explicit dependencies for the bundler from config file and global data.
// The file is generated by the Eleventy Serverless Bundler Plugin.
require('./eleventy-bundler-modules.js');

async function loadScreenshotURL(url) {
  const response = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Submissions?maxRecords=1&fields[]=screenshot&filterByFormula=SEARCH("${url}", URL)`,
    {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('unable to load screenshot');
  }

  const data = await response.json();

  const [site] = data.records;

  if (!site) {
    return 'https://res.cloudinary.com/netlify/image/upload/f_auto,q_auto/dusty-domains/default-card.jpg';
  }

  return site.fields.screenshot;
}

async function handler(event) {
  let elev = new EleventyServerless('thanks', {
    path: event.path,
    query: event.queryStringParameters,
    functionsDir: './netlify/functions/',
  });

  try {
    let [page] = await elev.getOutput();

    const screenshot = await loadScreenshotURL(
      page.data.eleventy.serverless.path.site,
    );

    // If you want some of the data cascade available in `page.data`, use `eleventyConfig.dataFilterSelectors`.
    // Read more: https://www.11ty.dev/docs/config/#data-filter-selectors

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
      },
      body: page.content.replace(/DUSTY_DOMAINS_SCREENSHOT_URL/, screenshot),
    };
  } catch (error) {
    // Only console log for matching serverless paths
    // (otherwise you’ll see a bunch of BrowserSync 404s for non-dynamic URLs during --serve)
    if (elev.isServerlessUrl(event.path)) {
      console.log('Serverless Error:', error);
    }

    return {
      statusCode: error.httpStatusCode || 500,
      body: JSON.stringify(
        {
          error: error.message,
        },
        null,
        2,
      ),
    };
  }
}

// Choose one:
// * Runs on each request: AWS Lambda (or Netlify Function)
// * Runs on first request only: Netlify On-demand Builder
//   (don’t forget to `npm install @netlify/functions`)

// exports.handler = handler;

const { builder } = require('@netlify/functions');
exports.handler = builder(handler);
