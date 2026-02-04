import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

/**
 * HTTP Client for inter-service communication
 * Handles REST calls between microservices with retry logic and error handling
 */
@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET request to another service
   */
  async get<T>(serviceUrl: string, path: string, headers: Record<string, string> = {}): Promise<T> {
    try {
      const url = `${serviceUrl}${path}`;
      this.logger.debug(`GET ${url}`);

      const response = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`GET request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * POST request to another service
   */
  async post<T>(
    serviceUrl: string,
    path: string,
    data: any,
    headers: Record<string, string> = {},
  ): Promise<T> {
    try {
      const url = `${serviceUrl}${path}`;
      this.logger.debug(`POST ${url}`);

      const response = await firstValueFrom(
        this.httpService.post(url, data, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`POST request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * PATCH request to another service
   */
  async patch<T>(
    serviceUrl: string,
    path: string,
    data: any,
    headers: Record<string, string> = {},
  ): Promise<T> {
    try {
      const url = `${serviceUrl}${path}`;
      this.logger.debug(`PATCH ${url}`);

      const response = await firstValueFrom(
        this.httpService.patch(url, data, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`PATCH request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * DELETE request to another service
   */
  async delete<T>(
    serviceUrl: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<T> {
    try {
      const url = `${serviceUrl}${path}`;
      this.logger.debug(`DELETE ${url}`);

      const response = await firstValueFrom(
        this.httpService.delete(url, { headers }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`DELETE request failed: ${error.message}`);
      throw error;
    }
  }
}
