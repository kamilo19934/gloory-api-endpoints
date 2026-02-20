import { Module, Global } from '@nestjs/common';
import { ReservoService } from './reservo.service';

@Global()
@Module({
  providers: [ReservoService],
  exports: [ReservoService],
})
export class ReservoModule {}
