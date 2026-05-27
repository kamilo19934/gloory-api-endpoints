import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { NotionService } from './notion.service';
import { NotionController } from './notion.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Client])],
  controllers: [NotionController],
  providers: [NotionService],
  exports: [NotionService],
})
export class NotionModule {}
