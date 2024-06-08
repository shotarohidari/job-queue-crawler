import {Crawler} from "./crawler.js";

const url = "";
const crawler = new Crawler([url]);

const result = await crawler.run();

console.log(result);