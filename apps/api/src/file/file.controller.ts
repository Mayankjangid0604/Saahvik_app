import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';
import * as fs from 'fs';
import * as path from 'path';

interface AuthUser {
  userId: string;
  orgId: string;
  role: string;
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(
    @Inject(FileService) private readonly fileService: FileService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      storage: undefined, // use memory storage (buffer)
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category?: string,
  ) {
    if (!file) {
      throw new NotFoundException('No file uploaded');
    }

    const result = await this.fileService.upload(user.orgId, file, category);
    return wrapSuccess(result, 'v1');
  }

  @Get(':key(*)')
  async getFile(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    // If local storage, stream the file directly (never expose static route)
    if (this.fileService.isUsingLocalStorage()) {
      const filePath = this.fileService.getLocalFilePath(key);
      if (!filePath) {
        throw new NotFoundException('File not found');
      }

      // Verify org ownership
      if (!key.startsWith(`${user.orgId}/`)) {
        throw new NotFoundException('File not found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      res.set('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.set('Cache-Control', 'private, max-age=300');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      return;
    }

    // For S3, redirect to presigned URL
    const signedUrl = await this.fileService.getSignedUrl(user.orgId, key);
    res.redirect(signedUrl);
  }

  @Delete(':key(*)')
  async deleteFile(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
  ) {
    await this.fileService.delete(user.orgId, key);
    return wrapSuccess({ deleted: true }, 'v1');
  }
}
