import { IsArray, IsUUID } from 'class-validator';

export class ProcessReservoSelectedDto {
  @IsArray()
  @IsUUID('4', { each: true })
  confirmationIds: string[];
}
