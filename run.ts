import { callEndpoint } from "./src/rfetch";

console.time("Batch finish");
await callEndpoint();
console.timeEnd("Batch finish");
