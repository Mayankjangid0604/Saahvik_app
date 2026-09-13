import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { FileModule } from '../file/file.module';

@Module({
  imports: [FileModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
