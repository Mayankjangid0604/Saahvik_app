import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { LocalStorage } from './storage/local.storage';
import { S3Storage } from './storage/s3.storage';

@Module({
  imports: [ConfigModule],
  controllers: [FileController],
  providers: [FileService, LocalStorage, S3Storage],
  exports: [FileService],
})
export class FileModule {}
