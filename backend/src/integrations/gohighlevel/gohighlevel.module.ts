import { Module, Global } from '@nestjs/common';
import { GoHighLevelService } from './gohighlevel.service';

@Global()
@Module({
  providers: [GoHighLevelService],
  exports: [GoHighLevelService],
})
export class GoHighLevelModule {}
