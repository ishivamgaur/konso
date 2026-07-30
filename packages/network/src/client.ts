import { request } from "undici";
import { logger } from "@konso/core";

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export class HttpClient {
  async get(url: string): Promise<HttpResponse> {
    logger.info({ url }, "GET request");
    const { statusCode, headers, body } = await request(url);
    const text = await body.text();
    return {
      status: statusCode,
      headers: headers as Record<string, string | string[] | undefined>,
      body: text,
    };
  }

  async post(url: string, data: string): Promise<HttpResponse> {
    logger.info({ url }, "POST request");
    const { statusCode, headers, body } = await request(url, {
      method: "POST",
      body: data,
      headers: { "Content-Type": "application/json" },
    });
    const text = await body.text();
    return {
      status: statusCode,
      headers: headers as Record<string, string | string[] | undefined>,
      body: text,
    };
  }
}
