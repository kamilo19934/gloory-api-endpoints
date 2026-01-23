import { IsArray, IsUUID } from 'class-validator';

export class ProcessSelectedDto {
  @IsArray()
  @IsUUID('4', { each: true })
  confirmationIds: string[];
}
