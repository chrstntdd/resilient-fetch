import { Application, Router, Context } from "https://deno.land/x/oak/mod.ts";
import { faker } from "https://esm.sh/@faker-js/faker@8.4.1";
import logger from "https://deno.land/x/oak_logger/mod.ts";

let port = 5555;

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

// Generate mock products
const generateProducts = (count: number): Product[] =>
  Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: parseFloat(faker.commerce.price()),
  }));

const products = generateProducts(1000); // Adjust the number of products as needed

// Rate limiting setup
const RATE_LIMIT_PROBABILITY = 0.1; // Probability of being rate-limited
const RETRY_AFTER_SECONDS = 5;
const rateLimitedClients = new Map<string, number>();

function shouldRateLimit(ip: string): boolean {
  if (rateLimitedClients.has(ip)) {
    const retryAfter = rateLimitedClients.get(ip)!;
    if (Date.now() < retryAfter) {
      return true;
    }
    rateLimitedClients.delete(ip);
  }
  return false;
}

function applyRateLimit(ip: string) {
  const retryAfter = Date.now() + RETRY_AFTER_SECONDS * 1000;
  rateLimitedClients.set(ip, retryAfter);
}

// Oak application and router setup
const app = new Application();
const router = new Router();

router.get("/api/products", (context) => {
  const clientIp = context.request.ip; // Oak allows easy access to the client's IP
  if (shouldRateLimit(clientIp)) {
    context.response.status = 429;
    context.response.headers.set("Retry-After", RETRY_AFTER_SECONDS.toString());
    context.response.body = { message: "Too Many Requests" };
    return;
  }

  // Randomly apply rate limiting
  if (Math.random() < RATE_LIMIT_PROBABILITY) {
    applyRateLimit(clientIp);
    context.response.status = 429;
    context.response.headers.set("Retry-After", RETRY_AFTER_SECONDS.toString());
    context.response.body = { message: "Too Many Requests" };
    return;
  }

  const limit = parseInt(context.request.url.searchParams.get("limit") || "10");
  const offset = parseInt(
    context.request.url.searchParams.get("offset") || "0",
  );
  const paginatedProducts = products.slice(offset, offset + limit);

  context.response.body = {
    count: products.length,
    next:
      offset + limit < products.length
        ? `/api/products?offset=${offset + limit}&limit=${limit}`
        : null,
    previous:
      offset > 0
        ? `/api/products?offset=${Math.max(0, offset - limit)}&limit=${limit}`
        : null,
    results: paginatedProducts,
  };
});
router.get("/healthz", () => "ok");

app.use(logger.logger);
app.use(logger.responseTime);
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port });
