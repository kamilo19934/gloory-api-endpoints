import { Module, Global } from '@nestjs/common';
import { DentalsoftService } from './dentalsoft.service';

@Global()
@Module({
  providers: [DentalsoftService],
  exports: [DentalsoftService],
})
export class DentalsoftModule {}
