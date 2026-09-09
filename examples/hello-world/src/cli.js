import { greet } from './greeter.js';
try { console.log(greet(process.argv[2], process.argv[3])); }
catch (error) { console.error(error.message); process.exitCode = 1; }
