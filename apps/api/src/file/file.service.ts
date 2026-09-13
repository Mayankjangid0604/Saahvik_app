import {
  Injectable,
  Inject,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage/storage.interface';
import { LocalStorage } from './storage/local.storage';
import { S3Storage } from './storage/s3.storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly storage: StorageProvider;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(LocalStorage) private readonly localStorage: LocalStorage,
    @Inject(S3Storage) private readonly s3Storage: S3Storage,
  ) {
    const storageType = this.configService.get<string>('STORAGE_TYPE') || 'local';
    this.storage = storageType === 's3' ? this.s3Storage : this.localStorage;
    this.logger.log(`File storage configured: ${storageType}`);
  }

  /**
   * Store a buffer under a caller-chosen deterministic key (e.g. a payment
   * receipt keyed by payment ID) rather than a random uuid. The key must be
   * prefixed with the org ID so the existing ownership checks in this
   * service and FileController continue to apply.
   */
  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.storage.upload(key, buffer, contentType);
  }

  async upload(
    orgId: string,
    file: Express.Multer.File,
    category?: string,
  ): Promise<{ key: string; originalName: string; size: number; mimeType: string }> {
    const ext = path.extname(file.originalname);
    const prefix = category ? `${category}/` : '';
    const key = `${orgId}/${prefix}${uuidv4()}${ext}`;

    await this.storage.upload(key, file.buffer, file.mimetype);

    return {
      key,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  async getSignedUrl(orgId: string, key: string): Promise<string> {
    // Verify the key belongs to this org
    if (!key.startsWith(`${orgId}/`)) {
      throw new ForbiddenException('File does not belong to this organization');
    }

    return this.storage.getSignedUrl(key, 300); // 5 minutes
  }

  async delete(orgId: string, key: string): Promise<void> {
    if (!key.startsWith(`${orgId}/`)) {
      throw new ForbiddenException('File does not belong to this organization');
    }

    await this.storage.delete(key);
  }

  /**
   * For local storage only: read the file buffer directly.
   * Used by the controller when storage is local (no redirect to presigned URL).
   */
  getLocalFilePath(key: string): string | null {
    if (this.storage instanceof LocalStorage) {
      if (this.localStorage.fileExists(key)) {
        return this.localStorage.getFilePath(key);
      }
      return null;
    }
    return null;
  }

  isUsingLocalStorage(): boolean {
    return this.storage instanceof LocalStorage;
  }
}
