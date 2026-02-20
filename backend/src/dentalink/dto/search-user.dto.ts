import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchUserDto {
  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  id_sucursal?: number;
}
