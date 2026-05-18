import fs from "node:fs";
import https from "node:https";
import next from "next";

const isProduction = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const isDevelopment = !isProduction;
const hostname = "0.0.0.0";
const port = 3000;

const app = next({ dev: isDevelopment, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpsOptions = {
  key: fs.readFileSync("./certs/key.pem"),
  cert: fs.readFileSync("./certs/cert.pem"),
};

const server = https.createServer(httpsOptions, (request, response) => {
  void handle(request, response);
});

server.listen(port, hostname, () => {
  console.log(`SplitMates frontend ready at https://${hostname}:${port} (${isDevelopment ? "dev" : "prod"})`);
});
