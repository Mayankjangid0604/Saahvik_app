import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from './storage.interface';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class LocalStorage implements StorageProvider {
  private readonly logger = new Logger(LocalStorage.name);
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);
    this.logger.log(`File stored locally: ${key} (${contentType})`);
    return key;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    // For local storage, generate a token-based URL that the file controller will validate.
    // In development, we return a path that the authenticated controller endpoint handles.
    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'changeme')
      .update(`${key}:${Math.floor(Date.now() / 1000) + expiresInSeconds}`)
      .digest('hex');

    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return `/api/v1/files/${encodeURIComponent(key)}?token=${token}&expires=${expires}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted locally: ${key}`);
    }
  }

  getFilePath(key: string): string {
    return path.join(this.uploadDir, key);
  }

  fileExists(key: string): boolean {
    return fs.existsSync(path.join(this.uploadDir, key));
  }
}
