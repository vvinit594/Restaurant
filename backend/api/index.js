/**
 * Vercel serverless entry — forwards all requests to the Nest Express app.
 * Built Nest output lives at dist/src/main.js (module.exports = express app).
 */
module.exports = require('../dist/src/main.js');
