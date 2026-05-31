import { Module, Global } from '@nestjs/common';
import { SacmedService } from './sacmed.service';

@Global()
@Module({
  providers: [SacmedService],
  exports: [SacmedService],
})
export class SacmedModule {}
