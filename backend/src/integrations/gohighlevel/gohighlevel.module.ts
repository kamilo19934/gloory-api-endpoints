import { Module, Global } from '@nestjs/common';
import { GoHighLevelService } from './gohighlevel.service';
import { GHLOAuthModule } from '../../gohighlevel/oauth/ghl-oauth.module';

@Global()
@Module({
  imports: [GHLOAuthModule],
  providers: [GoHighLevelService],
  exports: [GoHighLevelService],
})
export class GoHighLevelModule {}
