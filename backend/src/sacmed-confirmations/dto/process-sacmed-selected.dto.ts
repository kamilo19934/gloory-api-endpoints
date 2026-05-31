import { IsArray, IsUUID } from 'class-validator';

export class ProcessSacmedSelectedDto {
  @IsArray()
  @IsUUID('4', { each: true })
  confirmationIds: string[];
}
